#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'

import {
  EXPECTED_FEISHU_SHEETS,
  buildFeishuOperatingLoopPackage,
  summarizeFeishuOperatingLoopPackage,
  validateFeishuOperatingLoopPackage,
} from './lib/operating-loop-feishu-pack.mjs'
import { importFeishuOperatingLoopPackage } from './lib/operating-loop-feishu-writer.mjs'
import {
  createHeliosApi,
  loginHelios,
  readTokenContext,
} from './lib/operating-loop-helios-api.mjs'

const FEISHU_BASE_URL = 'https://open.feishu.cn'

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

function parseArgs(argv) {
  const options = {
    apply: false,
    appUrl: readEnv('OPERATING_LOOP_SEED_APP_URL', readEnv('LIVE_AI_APP_URL', 'http://localhost:3000')),
    email: readEnv('OPERATING_LOOP_SEED_EMAIL', readEnv('LIVE_AI_APP_EMAIL', 'admin@acme.com')),
    password: readEnv('OPERATING_LOOP_SEED_PASSWORD', readEnv('LIVE_AI_APP_PASSWORD', 'secret')),
    rawJsonPath: null,
    selectedBusinessOrgCode: readEnv('OPERATING_LOOP_FEISHU_ORG_CODE'),
    spreadsheetToken: readEnv('FEISHU_SPREADSHEET_TOKEN', readEnv('FEISHU_DATA_WIKI_TOKEN')),
  }
  for (const arg of argv) {
    if (arg === '--apply') options.apply = true
    else if (arg.startsWith('--raw-json=')) options.rawJsonPath = arg.slice('--raw-json='.length)
    else if (arg.startsWith('--app-url=')) options.appUrl = arg.slice('--app-url='.length)
    else if (arg.startsWith('--email=')) options.email = arg.slice('--email='.length)
    else if (arg.startsWith('--password=')) options.password = arg.slice('--password='.length)
    else if (arg.startsWith('--source-org=')) options.selectedBusinessOrgCode = arg.slice('--source-org='.length)
    else if (arg.startsWith('--spreadsheet-token=')) options.spreadsheetToken = arg.slice('--spreadsheet-token='.length)
    else if (arg === '--help') {
      printHelp()
      process.exit(0)
    }
  }
  return options
}

function printHelp() {
  console.log(`Usage:
  yarn operating-loop:feishu:import -- --source-org=REG-A
  yarn operating-loop:feishu:import -- --raw-json=.tmp/feishu-rows.json --source-org=REG-A
  yarn operating-loop:feishu:import -- --source-org=REG-A --apply

Environment:
  FEISHU_APP_ID / FEISHU_APP_SECRET       Feishu app credentials for online reads
  FEISHU_SPREADSHEET_TOKEN                Spreadsheet token; defaults to FEISHU_DATA_WIKI_TOKEN
  OPERATING_LOOP_FEISHU_ORG_CODE          Source business org scope, for example REG-A
  OPERATING_LOOP_SEED_APP_URL             Helios app URL; defaults to http://localhost:3000
  OPERATING_LOOP_SEED_EMAIL/PASSWORD      Helios login used for API-backed writes

Default mode is dry-run. --apply writes through Helios HTTP APIs after validation passes.`)
}

async function readJson(response, label) {
  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`[operating-loop-feishu-import] ${label} expected JSON, got ${text.slice(0, 500)}`)
  }
  if (!response.ok || json?.code !== 0) {
    throw new Error(
      `[operating-loop-feishu-import] ${label} failed (${response.status}): ${JSON.stringify(json).slice(0, 800)}`,
    )
  }
  return json
}

function normalizeBaseUrl(value) {
  return String(value ?? '').replace(/\/+$/, '')
}

async function createTenantAccessToken() {
  const appId = readEnv('FEISHU_APP_ID')
  const appSecret = readEnv('FEISHU_APP_SECRET')
  if (!appId || !appSecret) {
    throw new Error('[operating-loop-feishu-import] FEISHU_APP_ID and FEISHU_APP_SECRET are required for online reads')
  }
  const response = await fetch(`${FEISHU_BASE_URL}/open-apis/auth/v3/tenant_access_token/internal/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  })
  const json = await readJson(response, 'tenant_access_token')
  const token = json?.tenant_access_token
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('[operating-loop-feishu-import] Feishu token response did not include tenant_access_token')
  }
  return token
}

async function listFeishuSheets(tenantAccessToken, spreadsheetToken) {
  const response = await fetch(
    `${FEISHU_BASE_URL}/open-apis/sheets/v3/spreadsheets/${encodeURIComponent(spreadsheetToken)}/sheets/query`,
    { headers: { Authorization: `Bearer ${tenantAccessToken}` } },
  )
  const json = await readJson(response, 'sheets.query')
  const sheets = json?.data?.sheets
  if (!Array.isArray(sheets)) {
    throw new Error('[operating-loop-feishu-import] sheets.query response did not include data.sheets')
  }
  return sheets.map((sheet) => ({
    title: String(sheet.title ?? ''),
    sheetId: String(sheet.sheet_id ?? sheet.sheetId ?? ''),
  }))
}

async function readFeishuSheetRows(tenantAccessToken, spreadsheetToken, sheetId) {
  const range = `${sheetId}!A1:Z5000`
  const response = await fetch(
    `${FEISHU_BASE_URL}/open-apis/sheets/v2/spreadsheets/${encodeURIComponent(spreadsheetToken)}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${tenantAccessToken}` } },
  )
  const json = await readJson(response, `values.${sheetId}`)
  const values = json?.data?.valueRange?.values
  if (!Array.isArray(values)) {
    throw new Error(`[operating-loop-feishu-import] values response for ${sheetId} did not include rows`)
  }
  return values
}

async function readFeishuPackageRows(options) {
  if (options.rawJsonPath) {
    const file = await readFile(resolve(process.cwd(), options.rawJsonPath), 'utf8')
    return JSON.parse(file)
  }
  if (!options.spreadsheetToken) {
    throw new Error('[operating-loop-feishu-import] FEISHU_SPREADSHEET_TOKEN or --spreadsheet-token is required')
  }
  const token = await createTenantAccessToken()
  const sheets = await listFeishuSheets(token, options.spreadsheetToken)
  const byTitle = new Map(sheets.map((sheet) => [sheet.title, sheet.sheetId]))
  const missing = EXPECTED_FEISHU_SHEETS.filter((sheetName) => !byTitle.has(sheetName))
  if (missing.length > 0) {
    throw new Error(`[operating-loop-feishu-import] Missing expected sheets: ${missing.join(', ')}`)
  }
  const tables = {}
  for (const sheetName of EXPECTED_FEISHU_SHEETS) {
    tables[sheetName] = await readFeishuSheetRows(token, options.spreadsheetToken, byTitle.get(sheetName))
  }
  return tables
}

async function main() {
  loadLocalEnvFiles()
  const options = parseArgs(process.argv.slice(2))
  const rawTables = await readFeishuPackageRows(options)
  const pack = buildFeishuOperatingLoopPackage(rawTables, {
    spreadsheetToken: options.spreadsheetToken,
    selectedBusinessOrgCode: options.selectedBusinessOrgCode,
  })
  const validation = validateFeishuOperatingLoopPackage(pack)
  const summary = summarizeFeishuOperatingLoopPackage(pack, validation)

  console.log(JSON.stringify(summary, null, 2))
  if (!validation.ok) {
    process.exitCode = 1
    return
  }
  if (!options.apply) {
    console.log('[operating-loop-feishu-import] Dry-run passed. Re-run with --apply after reviewing the summary.')
    return
  }
  const appUrl = normalizeBaseUrl(options.appUrl)
  const token = await loginHelios(appUrl, options.email, options.password)
  const scope = readTokenContext(token)
  if (!scope.organizationId || !scope.tenantId) {
    throw new Error('[operating-loop-feishu-import] Helios token is missing orgId or tenantId')
  }
  const api = createHeliosApi(appUrl, token)
  const result = await importFeishuOperatingLoopPackage({ api, pack, scope })
  console.log(JSON.stringify({
    appUrl,
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
    outcomes: result.outcomes,
    failed: result.failed,
    skipped: result.skipped,
    sourceDataConflicts: result.sourceDataConflicts,
  }, null, 2))
  if (result.failed.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error))
  process.exitCode = 1
})
