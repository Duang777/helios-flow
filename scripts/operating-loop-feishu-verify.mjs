#!/usr/bin/env node

import { config as loadDotenv } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  createHeliosApi,
  listAll,
  loginHelios,
  readTokenContext,
} from './lib/operating-loop-helios-api.mjs'
import { evaluateFeishuOperatingLoopVerification } from './lib/operating-loop-feishu-verifier.mjs'

function loadLocalEnvFiles() {
  for (const envPath of ['.env', 'apps/helios/.env']) {
    const absolutePath = resolve(process.cwd(), envPath)
    if (existsSync(absolutePath)) loadDotenv({ path: absolutePath, override: false, quiet: true })
  }
}

function readEnv(name, fallback = null) {
  const value = process.env[name]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function parseArgs(argv) {
  const options = {
    appUrl: readEnv('OPERATING_LOOP_SEED_APP_URL', 'http://localhost:3000').replace(/\/+$/, ''),
    email: readEnv('OPERATING_LOOP_SEED_EMAIL', 'admin@acme.com'),
    password: readEnv('OPERATING_LOOP_SEED_PASSWORD', 'secret'),
    asOf: readEnv('OPERATING_LOOP_FEISHU_VERIFY_AS_OF', new Date().toISOString().slice(0, 10)),
  }
  for (const arg of argv) {
    if (arg.startsWith('--app-url=')) options.appUrl = arg.slice('--app-url='.length).replace(/\/+$/, '')
    else if (arg.startsWith('--email=')) options.email = arg.slice('--email='.length)
    else if (arg.startsWith('--password=')) options.password = arg.slice('--password='.length)
    else if (arg.startsWith('--as-of=')) options.asOf = arg.slice('--as-of='.length)
    else if (arg === '--help') {
      console.log(`Usage:
  yarn operating-loop:feishu:verify -- --as-of=2026-08-12

This command does not seed or mutate business records. It runs governance rules,
then verifies imported Feishu records, the operating-loop digest, and its
proactive notification through the Helios APIs.`)
      process.exit(0)
    }
  }
  return options
}

async function main() {
  loadLocalEnvFiles()
  const options = parseArgs(process.argv.slice(2))
  const token = await loginHelios(options.appUrl, options.email, options.password)
  const scope = readTokenContext(token)
  if (!scope.organizationId || !scope.tenantId) {
    throw new Error('[operating-loop-feishu-verify] Helios token is missing orgId or tenantId')
  }
  const api = createHeliosApi(options.appUrl, token)

  const rules = await api('/api/governance/rules/run', {
    method: 'POST',
    body: JSON.stringify({ organizationId: scope.organizationId, asOf: options.asOf }),
  })
  const organizationParams = new URLSearchParams({
    view: 'manage',
    tenantId: scope.tenantId,
    ids: scope.organizationId,
    page: '1',
    pageSize: '1',
  })
  const [organizationResponse, customers, invoices, risks, digest, notifications] = await Promise.all([
    api(`/api/directory/organizations?${organizationParams.toString()}`),
    listAll(api, '/api/customers/companies'),
    listAll(api, '/api/commercial/invoices'),
    listAll(api, '/api/projects/risks'),
    api(`/api/insights/operating-loop/today?organizationId=${encodeURIComponent(scope.organizationId)}&asOf=${encodeURIComponent(options.asOf)}`),
    listAll(api, '/api/notifications?type=insights.operating_loop.digest'),
  ])
  const organization = Array.isArray(organizationResponse?.items)
    ? organizationResponse.items.find((item) => item?.id === scope.organizationId) ?? organizationResponse.items[0] ?? null
    : null
  const result = evaluateFeishuOperatingLoopVerification({
    organization,
    customers,
    invoices,
    risks,
    digest,
    notifications,
  })

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        asOf: options.asOf,
        organizationId: scope.organizationId,
        companyName: organization?.name ?? null,
        governanceRules: {
          created: rules?.summary?.created ?? rules?.created ?? null,
          updated: rules?.summary?.updated ?? rules?.updated ?? null,
        },
        metrics: result.metrics,
        failures: result.failures,
      },
      null,
      2,
    ),
  )
  if (!result.ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error))
  process.exitCode = 1
})
