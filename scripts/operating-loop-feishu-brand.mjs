#!/usr/bin/env node

import { config as loadDotenv } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  createHeliosApi,
  loginHelios,
  readTokenContext,
} from './lib/operating-loop-helios-api.mjs'
import { FEISHU_OPERATING_LOOP_COMPANY_NAME } from './lib/operating-loop-feishu-verifier.mjs'

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
    password: readEnv('OPERATING_LOOP_SEED_PASSWORD', readEnv('LIVE_AI_APP_PASSWORD')),
    companyName: readEnv('OPERATING_LOOP_FEISHU_COMPANY_NAME', FEISHU_OPERATING_LOOP_COMPANY_NAME),
    dryRun: false,
  }
  for (const arg of argv) {
    if (arg.startsWith('--app-url=')) options.appUrl = arg.slice('--app-url='.length).replace(/\/+$/, '')
    else if (arg.startsWith('--email=')) options.email = arg.slice('--email='.length)
    else if (arg.startsWith('--password=')) options.password = arg.slice('--password='.length)
    else if (arg.startsWith('--company-name=')) options.companyName = arg.slice('--company-name='.length).trim()
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--help') {
      console.log(`Usage:
  yarn operating-loop:feishu:brand
  yarn operating-loop:feishu:brand -- --company-name=北京四维图新科技股份有限公司

Renames the current Helios organization through /api/directory/organizations
so the running competition environment uses the Feishu package company subject.
Use --dry-run to inspect the current organization without mutating it.`)
      process.exit(0)
    }
  }
  if (!options.companyName) {
    throw new Error('[operating-loop-feishu-brand] Company name is required.')
  }
  if (!options.password) {
    throw new Error('[operating-loop-feishu-brand] Password is required. Set OPERATING_LOOP_SEED_PASSWORD or pass --password=...')
  }
  return options
}

async function readCurrentOrganization(api, scope) {
  const params = new URLSearchParams({
    view: 'manage',
    tenantId: scope.tenantId,
    ids: scope.organizationId,
    page: '1',
    pageSize: '1',
  })
  const response = await api(`/api/directory/organizations?${params.toString()}`)
  const organization = Array.isArray(response?.items)
    ? response.items.find((item) => item?.id === scope.organizationId) ?? response.items[0] ?? null
    : null
  if (!organization) {
    throw new Error(`[operating-loop-feishu-brand] Organization not found: ${scope.organizationId}`)
  }
  return organization
}

async function main() {
  loadLocalEnvFiles()
  const options = parseArgs(process.argv.slice(2))
  const token = await loginHelios(options.appUrl, options.email, options.password)
  const scope = readTokenContext(token)
  if (!scope.organizationId || !scope.tenantId) {
    throw new Error('[operating-loop-feishu-brand] Helios token is missing orgId or tenantId')
  }
  const api = createHeliosApi(options.appUrl, token)
  const before = await readCurrentOrganization(api, scope)
  if (!options.dryRun && before.name !== options.companyName) {
    await api('/api/directory/organizations', {
      method: 'PUT',
      body: JSON.stringify({
        id: scope.organizationId,
        tenantId: scope.tenantId,
        name: options.companyName,
      }),
    })
  }
  const after = options.dryRun ? before : await readCurrentOrganization(api, scope)
  const ok = after.name === options.companyName
  console.log(
    JSON.stringify(
      {
        ok,
        dryRun: options.dryRun,
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        previousName: before.name ?? null,
        currentName: after.name ?? null,
      },
      null,
      2,
    ),
  )
  if (!ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error))
  process.exitCode = 1
})
