const DEFAULT_CONCURRENCY = 6

import { detectFeishuSourceDataConflicts } from './operating-loop-feishu-pack.mjs'

function valueOf(item, ...keys) {
  for (const key of keys) {
    const value = item?.[key]
    if (value !== undefined && value !== null) return value
  }
  return null
}

function idOf(payload, label) {
  const id = valueOf(
    payload,
    'id',
    'companyId',
    'dealId',
    'projectId',
    'milestoneId',
    'riskId',
    'memberId',
    'contractId',
    'revenueId',
    'costId',
    'invoiceId',
    'paymentId',
    'allocationId',
    'kpiTargetId',
  )
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`${label} response did not include an id`)
  }
  return id
}

function sourceTag(entity, sourceId) {
  return `feishu:${entity}_id=${sourceId}`
}

function sourceNote(entity, sourceId, sourceOrgCode = null) {
  const parts = [sourceTag(entity, sourceId)]
  if (sourceOrgCode) parts.push(`org_id=${sourceOrgCode}`)
  return parts.join(';')
}

function mapOpportunityStatus(value) {
  const normalized = String(value ?? '').trim()
  if (['赢单', '已赢单', 'won', 'win'].includes(normalized)) return 'win'
  if (['丢单', '已丢单', 'lost', 'loose'].includes(normalized)) return 'lost'
  if (['关闭', '已关闭', 'closed'].includes(normalized)) return 'closed'
  return normalized || 'open'
}

function mapCostType(value) {
  const normalized = String(value ?? '').trim()
  if (['人工', '人力', '人员', 'labor'].includes(normalized)) return 'labor'
  if (['采购', '材料', 'purchase'].includes(normalized)) return 'purchase'
  if (['外包', 'outsourcing'].includes(normalized)) return 'outsourcing'
  return 'other'
}

function toCompanyPayload(item, scope) {
  return {
    ...scope,
    displayName: item.displayName,
    legalName: item.displayName,
    brandName: item.shortName,
    industry: item.industry,
    status: item.status,
    source: item.source,
    isActive: item.status !== 'inactive',
  }
}

function toEmployeePayload(item, scope) {
  return {
    ...scope,
    displayName: item.displayName,
    description: item.description,
    tags: item.tags,
    isActive: item.status !== '离职',
  }
}

function toDealPayload(item, scope, customerId) {
  return {
    ...scope,
    title: item.name,
    status: mapOpportunityStatus(item.status),
    pipelineStage: item.stage,
    valueAmount: item.estimatedAmount ? Number(item.estimatedAmount) : undefined,
    valueCurrency: 'CNY',
    probability: item.winProbability ?? undefined,
    expectedCloseAt: item.estimatedWinDate ?? undefined,
    source: item.source,
    companyIds: customerId ? [customerId] : [],
  }
}

function toProjectPayload(item, scope, references) {
  return {
    ...scope,
    name: item.name,
    code: item.code,
    status: item.status,
    customerEntityId: references.customerId ?? null,
    dealId: references.dealId ?? null,
    projectManagerId: references.projectManagerId ?? null,
    productLineCode: item.productLineCode,
    budgetRevenue: item.budgetRevenue,
    budgetCost: item.budgetCost,
    forecastRevenue: item.forecastRevenue,
    forecastCost: item.forecastCost,
    isActive: item.status !== 'cancelled',
  }
}

function toMilestonePayload(item, scope, projectId) {
  return {
    ...scope,
    projectId,
    name: `${item.name} [${sourceTag('milestone', item.sourceId)}]`,
    status: item.status,
    plannedDate: item.plannedDate,
    actualDate: item.actualDate,
    sortOrder: 0,
    isActive: true,
  }
}

function toRiskPayload(item, scope, references) {
  return {
    ...scope,
    projectId: references.projectId,
    title: `${item.riskType ?? '项目'}风险`,
    description: `${item.description}\n来源：${sourceTag('risk', item.sourceId)}`,
    riskType: item.riskType,
    status: item.status,
    ownerEmployeeId: references.ownerEmployeeId ?? null,
    isActive: true,
  }
}

function toContractPayload(item, scope, references) {
  return {
    ...scope,
    name: item.name,
    code: item.code,
    status: item.status,
    contractType: item.type,
    customerEntityId: references.customerId ?? null,
    projectId: references.projectId ?? null,
    dealId: references.dealId ?? null,
    amount: item.amount,
    currencyCode: item.currency,
    startDate: item.effectiveDate ?? item.signDate,
    endDate: item.expiryDate,
    paymentTerms: item.paymentTerms,
    isActive: item.status !== 'cancelled',
  }
}

function toRevenuePayload(item, scope, references) {
  return {
    ...scope,
    projectId: references.projectId,
    contractId: references.contractId,
    dataVersion: 'actual',
    amount: item.amount,
    currencyCode: item.currency,
    recognizedOn: item.date,
    note: `${sourceNote('revenue', item.sourceId, item.sourceOrgCode)};period=${item.periodCode};type=${item.revenueType ?? ''}`,
    isActive: true,
  }
}

function toCostPayload(item, scope, references) {
  return {
    ...scope,
    projectId: references.projectId,
    contractId: references.contractId,
    dataVersion: 'actual',
    costType: mapCostType(item.costType),
    amount: item.amount,
    currencyCode: item.currency,
    incurredOn: item.date,
    note: `${sourceNote('cost', item.sourceId, item.sourceOrgCode)};period=${item.periodCode};source_type=${item.costType ?? ''}`,
    isActive: true,
  }
}

function toInvoicePayload(item, scope, references) {
  return {
    ...scope,
    contractId: references.contractId,
    projectId: references.projectId,
    customerEntityId: references.customerId,
    invoiceNo: item.invoiceNo,
    status: item.status,
    amount: item.amount,
    currencyCode: item.currency,
    issuedOn: item.invoiceDate,
    dueDate: item.dueDate,
    isActive: true,
  }
}

function toPaymentPayload(item, scope, customerId) {
  return {
    ...scope,
    customerEntityId: customerId,
    paymentNo: item.paymentNo,
    status: 'posted',
    amount: item.amount,
    currencyCode: item.currency,
    paidOn: item.paymentDate,
    isActive: true,
  }
}

function toAllocationPayload(item, scope, references) {
  return {
    ...scope,
    invoiceId: references.invoiceId,
    paymentId: references.paymentId,
    allocatedAmount: item.amount,
    allocatedOn: item.date,
    isActive: true,
  }
}

function toKpiPayload(item, scope) {
  const targetValue = item.unit === 'ratio'
    ? (Number(item.targetValue) * 100).toFixed(2)
    : item.targetValue
  return {
    ...scope,
    metricKey: item.metricKey,
    unit: item.unit,
    periodType: item.periodType,
    periodKey: item.periodCode,
    targetValue,
    currencyCode: item.unit === 'amount' ? 'CNY' : null,
    note: `${sourceNote('kpi_target', item.sourceId, item.sourceOrgCode)};source_name=${item.sourceOrgName ?? ''};category=${item.businessCategory ?? ''}`,
    isActive: true,
  }
}

export const FEISHU_WRITE_ENTITY_ORDER = [
  'employees',
  'customers',
  'opportunities',
  'followups',
  'projects',
  'milestones',
  'risks',
  'contracts',
  'revenues',
  'costs',
  'invoices',
  'payments',
  'allocations',
  'kpiTargets',
]

export function buildFeishuWritePayloads(pack, scope, references) {
  const customerIds = references.customers ?? new Map()
  const employeeIds = references.employees ?? new Map()
  const opportunityIds = references.opportunities ?? new Map()
  const projectIds = references.projects ?? new Map()
  const contractIds = references.contracts ?? new Map()
  const invoiceIds = references.invoices ?? new Map()
  const paymentIds = references.payments ?? new Map()

  return {
    employees: pack.employees.map((item) => ({
      sourceId: item.sourceId,
      path: '/api/staff/team-members',
      payload: toEmployeePayload(item, scope),
    })),
    customers: pack.customers.map((item) => ({
      sourceId: item.sourceId,
      path: '/api/customers/companies',
      payload: toCompanyPayload(item, scope),
    })),
    opportunities: pack.opportunities.map((item) => ({
      sourceId: item.sourceId,
      path: '/api/customers/deals',
      payload: toDealPayload(item, scope, customerIds.get(item.customerSourceId) ?? null),
    })),
    followups: pack.followups.map((item) => ({
      sourceId: item.sourceId,
      path: '/api/customers/interactions',
      payload: {
        ...scope,
        entityId: customerIds.get(pack.opportunities.find((deal) => deal.sourceId === item.opportunitySourceId)?.customerSourceId) ?? null,
        dealId: opportunityIds.get(item.opportunitySourceId) ?? null,
        interactionType: 'followup',
        title: `商机跟进 ${item.sourceId}`,
        body: `${item.content}\n下一步：${item.nextPlan ?? '未填写'}\n来源：${sourceTag('followup', item.sourceId)}`,
        occurredAt: item.date ? `${item.date}T09:00:00.000Z` : undefined,
      },
    })),
    projects: pack.projects.map((item) => ({
      sourceId: item.sourceId,
      path: '/api/projects/projects',
      payload: toProjectPayload(item, scope, {
        customerId: customerIds.get(item.customerSourceId) ?? null,
        dealId: opportunityIds.get(item.opportunitySourceId) ?? null,
        projectManagerId: employeeIds.get(item.projectManagerSourceId) ?? null,
      }),
    })),
    milestones: pack.milestones.map((item) => ({
      sourceId: item.sourceId,
      path: '/api/projects/milestones',
      payload: toMilestonePayload(item, scope, projectIds.get(item.projectSourceId) ?? null),
    })),
    risks: pack.risks.map((item) => ({
      sourceId: item.sourceId,
      path: '/api/projects/risks',
      payload: toRiskPayload(item, scope, {
        projectId: projectIds.get(item.projectSourceId) ?? null,
        ownerEmployeeId: employeeIds.get(item.ownerEmployeeSourceId) ?? null,
      }),
    })),
    contracts: pack.contracts.map((item) => ({
      sourceId: item.sourceId,
      path: '/api/commercial/contracts',
      payload: toContractPayload(item, scope, {
        customerId: customerIds.get(item.customerSourceId) ?? null,
        projectId: projectIds.get(item.projectSourceId) ?? null,
        dealId: opportunityIds.get(item.opportunitySourceId) ?? null,
      }),
    })),
    revenues: pack.revenues.map((item) => ({
      sourceId: item.sourceId,
      path: '/api/commercial/revenues',
      payload: toRevenuePayload(item, scope, {
        projectId: projectIds.get(item.projectSourceId) ?? null,
        contractId: contractIds.get(item.contractSourceId) ?? null,
      }),
    })),
    costs: pack.costs.map((item) => ({
      sourceId: item.sourceId,
      path: '/api/commercial/costs',
      payload: toCostPayload(item, scope, {
        projectId: projectIds.get(item.projectSourceId) ?? null,
        contractId: contractIds.get(item.contractSourceId) ?? null,
      }),
    })),
    invoices: pack.invoices.map((item) => ({
      sourceId: item.sourceId,
      path: '/api/commercial/invoices',
      payload: toInvoicePayload(item, scope, {
        contractId: contractIds.get(item.contractSourceId) ?? null,
        projectId: projectIds.get(item.projectSourceId) ?? null,
        customerId: customerIds.get(item.customerSourceId) ?? null,
      }),
    })),
    payments: pack.payments.map((item) => ({
      sourceId: item.sourceId,
      path: '/api/commercial/payments',
      payload: toPaymentPayload(item, scope, customerIds.get(item.customerSourceId) ?? null),
    })),
    allocations: pack.allocations.map((item) => ({
      sourceId: item.sourceId,
      path: '/api/commercial/allocations',
      payload: toAllocationPayload(item, scope, {
        invoiceId: invoiceIds.get(item.invoiceSourceId) ?? null,
        paymentId: paymentIds.get(item.paymentSourceId) ?? null,
      }),
    })),
    kpiTargets: pack.kpiTargets.map((item) => ({
      sourceId: item.sourceId,
      path: '/api/insights/kpi-targets',
      payload: toKpiPayload(item, scope),
    })),
  }
}

async function listAll(api, path, options = {}) {
  const pageSize = options.pageSize ?? 100
  const items = []
  let page = 1
  const stableSort = options.stableSort ?? true
  while (true) {
    const separator = path.includes('?') ? '&' : '?'
    const sortQuery = stableSort ? '&sortField=createdAt&sortDir=asc' : ''
    const payload = await api(`${path}${separator}page=${page}&pageSize=${pageSize}${sortQuery}`)
    const pageItems = Array.isArray(payload?.items) ? payload.items : []
    items.push(...pageItems)
    if (pageItems.length < pageSize || (payload?.totalPages && page >= payload.totalPages)) break
    page += 1
  }
  return items
}

function createdAtTime(item) {
  const time = Date.parse(String(item?.createdAt ?? item?.created_at ?? ''))
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER
}

async function runWithConcurrency(items, handler, concurrency = DEFAULT_CONCURRENCY) {
  const results = []
  let cursor = 0
  async function worker() {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await handler(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, worker))
  return results
}

function readSourcePrefix(value, prefix) {
  const source = typeof value === 'string' ? value : ''
  return source.startsWith(prefix) ? source.slice(prefix.length).split(';')[0] : null
}

function readNotePrefix(value, prefix) {
  const note = typeof value === 'string' ? value : ''
  const index = note.indexOf(prefix)
  return index >= 0 ? note.slice(index + prefix.length).split(';')[0] : null
}

function readNameSourceId(value, prefix) {
  const name = typeof value === 'string' ? value : ''
  const index = name.indexOf(prefix)
  return index >= 0 ? name.slice(index + prefix.length).split(']')[0] : null
}

function allocationKey({ invoiceId, paymentId, allocatedAmount, allocatedOn }) {
  if (!invoiceId || !paymentId || !allocatedAmount) return null
  return [invoiceId, paymentId, allocatedAmount, allocatedOn ?? ''].join('|')
}

async function ensureGroup({
  api,
  packItems,
  existingItems,
  entity,
  path,
  buildPayload,
  existingKey,
  sourceKey = (item) => item.sourceId,
  references,
  label,
  shouldSkip,
  buildUpdatePayload,
  updatePath,
  concurrency,
}) {
  const existingBySource = new Map()
  for (const item of existingItems) {
    const key = existingKey(item)
    if (!key) continue
    const current = existingBySource.get(key)
    if (!current || createdAtTime(item) < createdAtTime(current)) {
      existingBySource.set(key, item)
    }
  }
  const outcomes = await runWithConcurrency(packItems, async (item) => {
    const skipReason = shouldSkip?.(item)
    if (skipReason) {
      return { sourceId: item.sourceId, status: 'skipped', reason: skipReason }
    }
    const key = sourceKey(item)
    const existing = existingBySource.get(key)
    if (existing?.id) {
      if (buildUpdatePayload && updatePath) {
        try {
          await api(updatePath, {
            method: 'PUT',
            body: JSON.stringify(buildUpdatePayload(existing, item)),
          })
          references?.set(item.sourceId, existing.id)
          return { sourceId: item.sourceId, status: 'updated', id: existing.id }
        } catch (error) {
          return { sourceId: item.sourceId, status: 'failed', error: error?.message ?? String(error) }
        }
      }
      references?.set(item.sourceId, existing.id)
      return { sourceId: item.sourceId, status: 'reused', id: existing.id }
    }
    try {
      const payload = buildPayload(item)
      const created = await api(path, { method: 'POST', body: JSON.stringify(payload) })
      const id = idOf(created, `${label} ${item.sourceId}`)
      references?.set(item.sourceId, id)
      return { sourceId: item.sourceId, status: 'created', id }
    } catch (error) {
      if (
        entity === 'allocations' &&
        typeof error?.message === 'string' &&
        (error.message.includes('Total allocation exceeds invoice amount') ||
          error.message.includes('Total allocation exceeds payment amount'))
      ) {
        return { sourceId: item.sourceId, status: 'skipped', reason: `existing_state_conflict: ${error.message}` }
      }
      return { sourceId: item.sourceId, status: 'failed', error: error?.message ?? String(error) }
    }
  }, concurrency)
  return {
    entity,
    total: outcomes.length,
    created: outcomes.filter((item) => item.status === 'created').length,
    reused: outcomes.filter((item) => item.status === 'reused').length,
    updated: outcomes.filter((item) => item.status === 'updated').length,
    skipped: outcomes.filter((item) => item.status === 'skipped'),
    failed: outcomes.filter((item) => item.status === 'failed'),
  }
}

async function ensureFollowups({ api, pack, scope, references, concurrency }) {
  const opportunitiesBySource = new Map(pack.opportunities.map((item) => [item.sourceId, item]))
  const outcomes = await runWithConcurrency(pack.followups, async (item) => {
    const opportunity = opportunitiesBySource.get(item.opportunitySourceId)
    const dealId = references.opportunities.get(item.opportunitySourceId)
    const entityId = opportunity ? references.customers.get(opportunity.customerSourceId) : null
    if (!dealId || !entityId) {
      return { sourceId: item.sourceId, status: 'failed', error: 'missing_followup_deal_or_customer_reference' }
    }
    const source = sourceTag('followup', item.sourceId)
    try {
      const existing = await api(`/api/customers/interactions?dealId=${encodeURIComponent(dealId)}&limit=100`)
      const found = (existing.items ?? []).find((row) => row?.source === source || String(row?.body ?? '').includes(source))
      if (found?.id) return { sourceId: item.sourceId, status: 'reused', id: found.id }
      const created = await api('/api/customers/interactions', {
        method: 'POST',
        body: JSON.stringify({
          ...scope,
          entityId,
          dealId,
          interactionType: 'followup',
          title: `商机跟进 ${item.sourceId}`,
          body: `${item.content}\n下一步：${item.nextPlan ?? '未填写'}\n来源：${source}`,
          source,
          occurredAt: item.date ? `${item.date}T09:00:00.000Z` : undefined,
        }),
      })
      return { sourceId: item.sourceId, status: 'created', id: idOf(created, `followup ${item.sourceId}`) }
    } catch (error) {
      return { sourceId: item.sourceId, status: 'failed', error: error?.message ?? String(error) }
    }
  }, concurrency)
  return {
    entity: 'followups',
    total: outcomes.length,
    created: outcomes.filter((item) => item.status === 'created').length,
    reused: outcomes.filter((item) => item.status === 'reused').length,
    updated: 0,
    skipped: [],
    failed: outcomes.filter((item) => item.status === 'failed'),
  }
}

function kpiNaturalKey(item) {
  return [item.metricKey, item.periodType, item.periodKey ?? item.periodCode].filter(Boolean).join('|')
}

export async function importFeishuOperatingLoopPackage({
  api,
  pack,
  scope,
  concurrency = DEFAULT_CONCURRENCY,
  logger = console,
}) {
  const references = {
    employees: new Map(),
    customers: new Map(),
    opportunities: new Map(),
    projects: new Map(),
    contracts: new Map(),
    invoices: new Map(),
    payments: new Map(),
  }
  const sourceDataConflicts = detectFeishuSourceDataConflicts(pack)
  const invalidAllocationSourceIds = new Map(
    sourceDataConflicts
      .filter((conflict) => conflict.code === 'allocation_exceeds_invoice_amount' || conflict.code === 'allocation_exceeds_payment_amount')
      .map((conflict) => [conflict.sourceId, conflict]),
  )
  const existing = {
    employees: await listAll(api, '/api/staff/team-members'),
    customers: await listAll(api, '/api/customers/companies'),
    opportunities: await listAll(api, '/api/customers/deals'),
    projects: await listAll(api, '/api/projects/projects'),
    milestones: await listAll(api, '/api/projects/milestones'),
    risks: await listAll(api, '/api/projects/risks'),
    contracts: await listAll(api, '/api/commercial/contracts'),
    revenues: await listAll(api, '/api/commercial/revenues'),
    costs: await listAll(api, '/api/commercial/costs'),
    invoices: await listAll(api, '/api/commercial/invoices'),
    payments: await listAll(api, '/api/commercial/payments'),
    allocations: await listAll(api, '/api/commercial/allocations'),
    kpiTargets: await listAll(api, '/api/insights/kpi-targets'),
  }

  const outcomes = []
  const run = async (config) => {
    const result = await ensureGroup({ ...config, api, references: config.references, concurrency })
    outcomes.push(result)
    logger.log(`[operating-loop-feishu-import] ${config.entity}: ${result.created} created, ${result.reused} reused, ${result.updated} updated, ${result.skipped.length} skipped, ${result.failed.length} failed`)
  }

  await run({
    entity: 'employees',
    label: 'employee',
    path: '/api/staff/team-members',
    packItems: pack.employees,
    existingItems: existing.employees,
    buildPayload: (item) => toEmployeePayload(item, scope),
    references: references.employees,
    existingKey: (item) => {
      const tag = Array.isArray(item.tags) ? item.tags.find((value) => String(value).startsWith('feishu:employee_id=')) : null
      return tag ? String(tag).slice('feishu:employee_id='.length) : null
    },
  })
  await run({
    entity: 'customers',
    label: 'customer',
    path: '/api/customers/companies',
    packItems: pack.customers,
    existingItems: existing.customers,
    buildPayload: (item) => toCompanyPayload(item, scope),
    references: references.customers,
    existingKey: (item) => readSourcePrefix(item.source, 'feishu:customer_id='),
  })
  await run({
    entity: 'opportunities',
    label: 'opportunity',
    path: '/api/customers/deals',
    packItems: pack.opportunities,
    existingItems: existing.opportunities,
    buildPayload: (item) => toDealPayload(item, scope, references.customers.get(item.customerSourceId) ?? null),
    references: references.opportunities,
    existingKey: (item) => readSourcePrefix(item.source, 'feishu:opportunity_id='),
  })
  const followupResult = await ensureFollowups({ api, pack, scope, references, concurrency })
  outcomes.push(followupResult)
  logger.log(`[operating-loop-feishu-import] followups: ${followupResult.created} created, ${followupResult.reused} reused, ${followupResult.updated} updated, ${followupResult.skipped.length} skipped, ${followupResult.failed.length} failed`)
  await run({
    entity: 'projects',
    label: 'project',
    path: '/api/projects/projects',
    packItems: pack.projects,
    existingItems: existing.projects,
    buildPayload: (item) =>
      toProjectPayload(item, scope, {
        customerId: references.customers.get(item.customerSourceId) ?? null,
        dealId: references.opportunities.get(item.opportunitySourceId) ?? null,
        projectManagerId: references.employees.get(item.projectManagerSourceId) ?? null,
      }),
    references: references.projects,
    existingKey: (item) => item.code ?? null,
  })
  await run({
    entity: 'milestones',
    label: 'milestone',
    path: '/api/projects/milestones',
    packItems: pack.milestones,
    existingItems: existing.milestones,
    buildPayload: (item) => toMilestonePayload(item, scope, references.projects.get(item.projectSourceId) ?? null),
    references: null,
    existingKey: (item) => readNameSourceId(item.name, '[feishu:milestone_id='),
  })
  await run({
    entity: 'risks',
    label: 'risk',
    path: '/api/projects/risks',
    packItems: pack.risks,
    existingItems: existing.risks,
    buildPayload: (item) =>
      toRiskPayload(item, scope, {
        projectId: references.projects.get(item.projectSourceId) ?? null,
        ownerEmployeeId: references.employees.get(item.ownerEmployeeSourceId) ?? null,
      }),
    references: null,
    existingKey: (item) => readNotePrefix(item.description, 'feishu:risk_id='),
  })
  await run({
    entity: 'contracts',
    label: 'contract',
    path: '/api/commercial/contracts',
    packItems: pack.contracts,
    existingItems: existing.contracts,
    buildPayload: (item) =>
      toContractPayload(item, scope, {
        customerId: references.customers.get(item.customerSourceId) ?? null,
        projectId: references.projects.get(item.projectSourceId) ?? null,
        dealId: references.opportunities.get(item.opportunitySourceId) ?? null,
      }),
    references: references.contracts,
    existingKey: (item) => item.code ?? null,
  })
  await run({
    entity: 'revenues',
    label: 'revenue',
    path: '/api/commercial/revenues',
    packItems: pack.revenues,
    existingItems: existing.revenues,
    buildPayload: (item) =>
      toRevenuePayload(item, scope, {
        projectId: references.projects.get(item.projectSourceId) ?? null,
        contractId: references.contracts.get(item.contractSourceId) ?? null,
      }),
    references: null,
    existingKey: (item) => readNotePrefix(item.note, 'feishu:revenue_id='),
  })
  await run({
    entity: 'costs',
    label: 'cost',
    path: '/api/commercial/costs',
    packItems: pack.costs,
    existingItems: existing.costs,
    buildPayload: (item) =>
      toCostPayload(item, scope, {
        projectId: references.projects.get(item.projectSourceId) ?? null,
        contractId: references.contracts.get(item.contractSourceId) ?? null,
      }),
    references: null,
    existingKey: (item) => readNotePrefix(item.note, 'feishu:cost_id='),
  })
  await run({
    entity: 'invoices',
    label: 'invoice',
    path: '/api/commercial/invoices',
    packItems: pack.invoices,
    existingItems: existing.invoices,
    buildPayload: (item) =>
      toInvoicePayload(item, scope, {
        contractId: references.contracts.get(item.contractSourceId) ?? null,
        projectId: references.projects.get(item.projectSourceId) ?? null,
        customerId: references.customers.get(item.customerSourceId) ?? null,
      }),
    references: references.invoices,
    existingKey: (item) => item.invoiceNo ?? null,
  })
  await run({
    entity: 'payments',
    label: 'payment',
    path: '/api/commercial/payments',
    packItems: pack.payments,
    existingItems: existing.payments,
    buildPayload: (item) => toPaymentPayload(item, scope, references.customers.get(item.customerSourceId) ?? null),
    references: references.payments,
    existingKey: (item) => item.paymentNo ?? null,
  })
  await run({
    entity: 'allocations',
    label: 'allocation',
    path: '/api/commercial/allocations',
    packItems: pack.allocations,
    existingItems: existing.allocations,
    buildPayload: (item) =>
      toAllocationPayload(item, scope, {
        invoiceId: references.invoices.get(item.invoiceSourceId) ?? null,
        paymentId: references.payments.get(item.paymentSourceId) ?? null,
      }),
    references: null,
    shouldSkip: (item) => {
      const conflict = invalidAllocationSourceIds.get(item.sourceId)
      if (!conflict) return null
      const limit = conflict.invoiceAmount ?? conflict.paymentAmount
      return `${conflict.code}: running allocation ${conflict.runningAllocatedAmount} exceeds limit ${limit}`
    },
    sourceKey: (item) =>
      allocationKey({
        invoiceId: references.invoices.get(item.invoiceSourceId) ?? null,
        paymentId: references.payments.get(item.paymentSourceId) ?? null,
        allocatedAmount: item.amount,
        allocatedOn: item.date,
      }),
    existingKey: (item) => allocationKey(item),
  })
  await run({
    entity: 'kpiTargets',
    label: 'kpi target',
    path: '/api/insights/kpi-targets',
    packItems: pack.kpiTargets,
    existingItems: existing.kpiTargets,
    buildPayload: (item) => toKpiPayload(item, scope),
    references: null,
    sourceKey: (item) => kpiNaturalKey({ metricKey: item.metricKey, periodType: item.periodType, periodKey: item.periodCode }),
    existingKey: (item) => kpiNaturalKey(item),
    buildUpdatePayload: (existing, item) => ({ id: existing.id, ...toKpiPayload(item, scope) }),
    updatePath: '/api/insights/kpi-targets',
  })

  return {
    outcomes,
    failed: outcomes.flatMap((result) => result.failed.map((failure) => ({ entity: result.entity, ...failure }))),
    skipped: outcomes.flatMap((result) => result.skipped.map((skipped) => ({ entity: result.entity, ...skipped }))),
    sourceDataConflicts,
    references,
  }
}

export function findExistingInteractionSource(item, sourceId) {
  return typeof item?.title === 'string' && item.title.includes(`跟进 ${sourceId}`)
}
