#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'

const DEFAULT_SEED_CODE = 'OPERATING-LOOP-QA'
const DEFAULT_AS_OF = '2026-08-31'

function loadLocalEnvFiles() {
  for (const envPath of ['.env', 'apps/helios/.env']) {
    const absolutePath = resolve(process.cwd(), envPath)
    if (existsSync(absolutePath)) {
      loadDotenv({ path: absolutePath, override: false, quiet: true })
    }
  }
}

function readEnv(name, fallback = null) {
  const value = process.env[name]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function normalizeBaseUrl(value) {
  return String(value ?? '').replace(/\/+$/, '')
}

async function readJson(response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    throw new Error(`[operating-loop-seed] Expected JSON, got: ${text.slice(0, 500)}`)
  }
}

function readTokenContext(token) {
  const parts = String(token).split('.')
  if (parts.length < 2) throw new Error('[operating-loop-seed] Login token is not a JWT')
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  return {
    organizationId: payload.orgId ?? '',
    tenantId: payload.tenantId ?? '',
  }
}

async function login(appUrl, email, password) {
  const form = new URLSearchParams()
  form.set('email', email)
  form.set('password', password)
  const response = await fetch(`${appUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  const json = await readJson(response)
  if (!response.ok || typeof json?.token !== 'string') {
    throw new Error(`[operating-loop-seed] Login failed (${response.status})`)
  }
  return json.token
}

function createApi(appUrl, token) {
  return async function api(path, init = {}) {
    const response = await fetch(`${appUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    })
    const json = await readJson(response)
    if (!response.ok) {
      throw new Error(
        `[operating-loop-seed] ${init.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(json).slice(0, 500)}`,
      )
    }
    return json
  }
}

function firstItem(payload) {
  return Array.isArray(payload?.items) ? payload.items[0] ?? null : null
}

function requiredId(payload, label) {
  const id = payload?.id ?? payload?.companyId ?? payload?.projectId ?? payload?.contractId ?? payload?.invoiceId ?? payload?.paymentId ?? payload?.allocationId ?? payload?.revenueId ?? payload?.costId ?? payload?.kpiTargetId
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`[operating-loop-seed] ${label} response did not include an id`)
  }
  return id
}

async function createCompany(api, scope, { displayName, domain }) {
  const created = await api('/api/customers/companies', {
    method: 'POST',
    body: JSON.stringify({
      ...scope,
      displayName,
      legalName: displayName,
      domain,
      isActive: true,
    }),
  })
  return requiredId(created, `company ${displayName}`)
}

async function ensureDuplicateCompanies(api, scope, { displayName, domain }) {
  const listed = await api(`/api/customers/companies?search=${encodeURIComponent(displayName)}&page=1&pageSize=20`)
  const existing = (listed.items ?? []).filter((item) => item.displayName === displayName && item.id)
  const ids = existing.map((item) => item.id)
  while (ids.length < 2) {
    const suffix = ids.length === 0 ? '' : `-${ids.length + 1}`
    const scopedDomain = domain.replace(/(\.[^.]+)$/, `${suffix}$1`)
    ids.push(await createCompany(api, scope, { displayName, domain: scopedDomain }))
  }
  return [ids[0], ids[1]]
}

async function getOrCreateBySearch(api, { listPath, createPath, search, match, payload, idLabel }) {
  const listed = await api(`${listPath}?search=${encodeURIComponent(search)}&page=1&pageSize=20`)
  const existing = (listed.items ?? []).find(match)
  if (existing?.id) return existing.id
  return requiredId(
    await api(createPath, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    idLabel,
  )
}

async function getOrCreateFirst(api, { listPath, createPath, payload, idLabel }) {
  const listed = await api(listPath)
  const existing = firstItem(listed)
  if (existing?.id) return existing.id
  return requiredId(
    await api(createPath, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    idLabel,
  )
}

async function seedOperatingLoop() {
  loadLocalEnvFiles()
  const appUrl = normalizeBaseUrl(readEnv('OPERATING_LOOP_SEED_APP_URL', readEnv('LIVE_AI_APP_URL', 'http://localhost:3000')))
  const email = readEnv('OPERATING_LOOP_SEED_EMAIL', readEnv('LIVE_AI_APP_EMAIL', 'admin@acme.com'))
  const password = readEnv('OPERATING_LOOP_SEED_PASSWORD', readEnv('LIVE_AI_APP_PASSWORD', 'secret'))
  const seedCode = readEnv('OPERATING_LOOP_SEED_CODE', DEFAULT_SEED_CODE)
  const asOf = readEnv('OPERATING_LOOP_SEED_AS_OF', DEFAULT_AS_OF)

  const token = await login(appUrl, email, password)
  const scope = readTokenContext(token)
  if (!scope.organizationId || !scope.tenantId) {
    throw new Error('[operating-loop-seed] Login token is missing orgId or tenantId')
  }
  const api = createApi(appUrl, token)

  const [customerAId, customerBId] = await ensureDuplicateCompanies(api, scope, {
    displayName: `${seedCode} Customer`,
    domain: `${seedCode.toLowerCase()}.example`,
  })

  const projectId = await getOrCreateBySearch(api, {
    listPath: '/api/projects/projects',
    createPath: '/api/projects/projects',
    search: seedCode,
    match: (item) => item.code === seedCode,
    idLabel: 'project',
    payload: {
      ...scope,
      name: `${seedCode} Delayed Project`,
      code: seedCode,
      status: 'active',
      customerEntityId: customerAId,
      budgetRevenue: '1000.00',
      budgetCost: '100.00',
      forecastRevenue: '900.00',
      forecastCost: '180.00',
      isActive: true,
    },
  })

  const milestoneId = await getOrCreateFirst(api, {
    listPath: `/api/projects/milestones?projectId=${projectId}&page=1&pageSize=20`,
    createPath: '/api/projects/milestones',
    idLabel: 'milestone',
    payload: {
      ...scope,
      projectId,
      name: `${seedCode} Acceptance Milestone`,
      status: 'planned',
      plannedDate: '2026-08-01',
      sortOrder: 10,
      isActive: true,
    },
  })

  const contractId = await getOrCreateBySearch(api, {
    listPath: '/api/commercial/contracts',
    createPath: '/api/commercial/contracts',
    search: seedCode,
    match: (item) => item.code === seedCode,
    idLabel: 'contract',
    payload: {
      ...scope,
      name: `${seedCode} Contract`,
      code: seedCode,
      status: 'active',
      contractType: 'sales',
      customerEntityId: customerAId,
      projectId,
      amount: '1000.00',
      currencyCode: 'CNY',
      startDate: '2026-08-01',
      endDate: '2026-12-31',
      paymentTerms: 'Net 10',
      isActive: true,
    },
  })

  const revenueId = await getOrCreateFirst(api, {
    listPath: `/api/commercial/revenues?projectId=${projectId}&page=1&pageSize=20`,
    createPath: '/api/commercial/revenues',
    idLabel: 'revenue',
    payload: {
      ...scope,
      projectId,
      contractId,
      dataVersion: 'actual',
      amount: '500.00',
      currencyCode: 'CNY',
      recognizedOn: '2026-08-15',
      note: seedCode,
      isActive: true,
    },
  })

  const costId = await getOrCreateFirst(api, {
    listPath: `/api/commercial/costs?projectId=${projectId}&page=1&pageSize=20`,
    createPath: '/api/commercial/costs',
    idLabel: 'cost',
    payload: {
      ...scope,
      projectId,
      contractId,
      dataVersion: 'actual',
      costType: 'labor',
      amount: '180.00',
      currencyCode: 'CNY',
      incurredOn: '2026-08-20',
      note: seedCode,
      isActive: true,
    },
  })

  const invoiceId = await getOrCreateBySearch(api, {
    listPath: '/api/commercial/invoices',
    createPath: '/api/commercial/invoices',
    search: seedCode,
    match: (item) => item.invoiceNo === seedCode,
    idLabel: 'invoice',
    payload: {
      ...scope,
      contractId,
      projectId,
      customerEntityId: customerAId,
      invoiceNo: seedCode,
      status: 'issued',
      amount: '500.00',
      currencyCode: 'CNY',
      issuedOn: '2026-08-05',
      dueDate: '2026-08-10',
      isActive: true,
    },
  })

  const paymentId = await getOrCreateBySearch(api, {
    listPath: '/api/commercial/payments',
    createPath: '/api/commercial/payments',
    search: seedCode,
    match: (item) => item.paymentNo === seedCode,
    idLabel: 'payment',
    payload: {
      ...scope,
      customerEntityId: customerAId,
      paymentNo: seedCode,
      status: 'posted',
      amount: '300.00',
      currencyCode: 'CNY',
      paidOn: '2026-08-18',
      isActive: true,
    },
  })

  const allocationId = await getOrCreateFirst(api, {
    listPath: `/api/commercial/allocations?invoiceId=${invoiceId}&paymentId=${paymentId}&page=1&pageSize=20`,
    createPath: '/api/commercial/allocations',
    idLabel: 'allocation',
    payload: {
      ...scope,
      invoiceId,
      paymentId,
      allocatedAmount: '300.00',
      allocatedOn: '2026-08-18',
      isActive: true,
    },
  })

  const targetRows = await api(
    `/api/insights/kpi-targets?metricKey=gross_profit&periodType=month&periodKey=2026-08&page=1&pageSize=20`,
  )
  let kpiTargetId = (targetRows.items ?? []).find((item) => item.note === seedCode)?.id
  if (!kpiTargetId) {
    kpiTargetId = requiredId(
      await api('/api/insights/kpi-targets', {
        method: 'POST',
        body: JSON.stringify({
          ...scope,
          metricKey: 'gross_profit',
          unit: 'amount',
          periodType: 'month',
          periodKey: '2026-08',
          targetValue: '600.00',
          currencyCode: 'CNY',
          note: seedCode,
          isActive: true,
        }),
      }),
      'kpi target',
    )
  }

  const identityMapRows = await api(`/api/governance/identity-maps?status=active&page=1&pageSize=100`)
  let identityMapId = (identityMapRows.items ?? []).find(
    (item) => item.sourceEntityId === customerBId && item.canonicalEntityId === customerAId,
  )?.id
  if (!identityMapId) {
    identityMapId = requiredId(
      await api('/api/governance/identity-maps', {
        method: 'POST',
        body: JSON.stringify({
          ...scope,
          sourceEntityId: customerBId,
          sourceCustomerCode: `${seedCode}-DUP`,
          canonicalEntityId: customerAId,
          canonicalCustomerCode: seedCode,
          rationale: 'Seeded operating-loop duplicate customer map; source row remains intact.',
          status: 'active',
          isSimulation: true,
          isActive: true,
        }),
      }),
      'identity map',
    )
  }

  const rules = await api('/api/governance/rules/run', {
    method: 'POST',
    body: JSON.stringify({ ...scope, asOf }),
  })
  const findings = await api(`/api/governance/findings?status=open&page=1&pageSize=100`)
  const relevantFindings = (findings.items ?? []).filter((item) => {
    const evidence = Array.isArray(item.evidenceIds) ? item.evidenceIds : []
    return evidence.some((entry) =>
      [projectId, milestoneId, invoiceId, customerAId, customerBId].includes(entry?.id),
    )
  })

  return {
    appUrl,
    seedCode,
    asOf,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    ids: {
      customerAId,
      customerBId,
      projectId,
      milestoneId,
      contractId,
      revenueId,
      costId,
      invoiceId,
      paymentId,
      allocationId,
      kpiTargetId,
      identityMapId,
    },
    rules,
    findings: relevantFindings.map((finding) => ({
      id: finding.id,
      ruleId: finding.ruleId,
      severity: finding.severity,
      subjectType: finding.subjectType,
      subjectId: finding.subjectId,
      href: `/backend/governance/findings/${finding.id}`,
    })),
    liveEvalEnv: {
      LIVE_AI_APP_URL: appUrl,
      LIVE_AI_ORGANIZATION_ID: scope.organizationId,
      LIVE_AI_PROJECT_ID: projectId,
    },
  }
}

seedOperatingLoop()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2))
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
