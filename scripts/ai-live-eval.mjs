#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'

const REQUIRED_OPERATING_LOOP_TOOLS = [
  'projects__get_delay_summary',
  'commercial__get_project_settlement_summary',
  'insights__get_kpi_gap',
  'governance__list_findings',
]

const DEFAULT_PROMPT =
  '项目 project-live-qa 是否延期？合同回款怎样？KPI 差多少？有哪些治理检出？'

function loadLocalEnvFiles() {
  for (const envPath of ['.env', 'apps/helios/.env']) {
    const absolutePath = resolve(process.cwd(), envPath)
    if (existsSync(absolutePath)) {
      loadDotenv({ path: absolutePath, override: false, quiet: true })
    }
  }
}

function readEnv(name, aliases = []) {
  const names = [name, ...aliases]
  for (const key of names) {
    const value = process.env[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return null
}

function requireEnv(name, aliases = []) {
  const value = readEnv(name, aliases)
  if (!value) {
    throw new Error(
      `[ai-live-eval] Missing ${name}${aliases.length ? ` (aliases: ${aliases.join(', ')})` : ''}`,
    )
  }
  return value
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '')
}

function toResponsesApiBaseUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl)
  return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`
}

function toProviderRootUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl)
  return normalized.endsWith('/v1') ? normalized.slice(0, -3) : normalized
}

async function readJson(response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`[ai-live-eval] Expected JSON, got: ${text.slice(0, 500)}`)
  }
}

async function providerFetch(baseUrl, apiKey, path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const json = await readJson(response)
  if (!response.ok || json.error) {
    const message = json.error?.message ?? JSON.stringify(json).slice(0, 500)
    const code = json.error?.code ?? response.status
    throw new Error(`[ai-live-eval] Provider ${path} failed (${code}): ${message}`)
  }
  return json
}

function extractResponseText(responseJson) {
  if (typeof responseJson.output_text === 'string' && responseJson.output_text.length > 0) {
    return responseJson.output_text
  }
  const output = Array.isArray(responseJson.output) ? responseJson.output : []
  return output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .filter((part) => part?.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
}

function extractFunctionCalls(responseJson) {
  const output = Array.isArray(responseJson.output) ? responseJson.output : []
  return output
    .filter((item) => item?.type === 'function_call' && typeof item.name === 'string')
    .map((item) => ({
      name: item.name,
      arguments: item.arguments ?? '{}',
      callId: item.call_id ?? null,
    }))
}

async function listModels(baseUrl, apiKey) {
  const json = await providerFetch(baseUrl, apiKey, '/models', { method: 'GET' })
  const models = Array.isArray(json.data)
    ? json.data.map((entry) => entry?.id).filter((id) => typeof id === 'string').sort()
    : []
  return models
}

async function runResponsesSmoke(baseUrl, apiKey, model) {
  const json = await providerFetch(baseUrl, apiKey, '/responses', {
    method: 'POST',
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: 'Reply with ok.' }],
        },
      ],
      stream: false,
    }),
  })
  return {
    id: json.id ?? null,
    status: json.status ?? null,
    text: extractResponseText(json).slice(0, 200),
  }
}

async function runOperatingLoopToolSelection(baseUrl, apiKey, model, prompt) {
  const json = await providerFetch(baseUrl, apiKey, '/responses', {
    method: 'POST',
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text:
                'You are testing tool selection for Helios Operating Loop Assistant. Use all relevant tools before answering.',
            },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        },
      ],
      tools: [
        {
          type: 'function',
          name: 'projects__get_delay_summary',
          description: 'Get a project delay summary.',
          parameters: {
            type: 'object',
            properties: { projectId: { type: 'string' } },
            additionalProperties: true,
          },
        },
        {
          type: 'function',
          name: 'commercial__get_project_settlement_summary',
          description: 'Get contract, invoice, collection, and AR metrics for a project.',
          parameters: {
            type: 'object',
            properties: { projectId: { type: 'string' } },
            additionalProperties: true,
          },
        },
        {
          type: 'function',
          name: 'insights__get_kpi_gap',
          description: 'Get KPI target, actual, gap, and dragged organizations.',
          parameters: {
            type: 'object',
            properties: { projectId: { type: 'string' }, metricKey: { type: 'string' } },
            additionalProperties: true,
          },
        },
        {
          type: 'function',
          name: 'governance__list_findings',
          description: 'List governance findings and evidence for an operating loop subject.',
          parameters: {
            type: 'object',
            properties: { projectId: { type: 'string' }, status: { type: 'string' } },
            additionalProperties: true,
          },
        },
      ],
      tool_choice: 'auto',
      stream: false,
    }),
  })

  const calls = extractFunctionCalls(json)
  const calledNames = calls.map((call) => call.name)
  const missing = REQUIRED_OPERATING_LOOP_TOOLS.filter((toolName) => !calledNames.includes(toolName))
  if (missing.length > 0) {
    throw new Error(
      `[ai-live-eval] Operating-loop tool selection missed required tools: ${missing.join(', ')}`,
    )
  }
  return { id: json.id ?? null, calls }
}

async function loginApp(appUrl, email, password) {
  const form = new URLSearchParams()
  form.set('email', email)
  form.set('password', password)
  const response = await fetch(`${appUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  const json = await readJson(response)
  if (!response.ok || typeof json.token !== 'string') {
    throw new Error(`[ai-live-eval] App login failed (${response.status})`)
  }
  return json.token
}

function decodeSseText(raw) {
  const chunks = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') continue
    try {
      const json = JSON.parse(data)
      if (json.type === 'text-delta' && typeof json.delta === 'string') chunks.push(json.delta)
      else if (json.type === 'text' && typeof json.content === 'string') chunks.push(json.content)
      else if (!json.type && typeof json.content === 'string') chunks.push(json.content)
    } catch {
      // Ignore non-JSON SSE chunks.
    }
  }
  return chunks.join('')
}

async function runAppChatSmoke({ appUrl, email, password, provider, model, upstreamBaseUrl }) {
  const token = await loginApp(appUrl, email, password)
  const url = new URL(`${appUrl}/api/ai_assistant/ai/chat`)
  url.searchParams.set('agent', readEnv('LIVE_AI_AGENT') ?? 'insights.operating_loop_assistant')
  url.searchParams.set('provider', provider)
  url.searchParams.set('model', model)
  url.searchParams.set('baseUrl', `${upstreamBaseUrl}/v1`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content:
            '不要调用工具。用一句中文回答：你是谁？必须包含 Operating Loop Assistant。',
        },
      ],
      debug: true,
    }),
  })
  const raw = await response.text()
  if (!response.ok) {
    throw new Error(`[ai-live-eval] App chat failed (${response.status}): ${raw.slice(0, 500)}`)
  }
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    text: decodeSseText(raw).slice(0, 500),
  }
}

async function main() {
  loadLocalEnvFiles()

  const apiKey = requireEnv('LIVE_AI_API_KEY', ['OPENAI_API_KEY'])
  const baseUrl = normalizeBaseUrl(
    requireEnv('LIVE_AI_BASE_URL', ['HELIOS_AI_BASE_URL', 'OPENAI_BASE_URL']),
  )
  const apiBaseUrl = toResponsesApiBaseUrl(baseUrl)
  const upstreamBaseUrl = toProviderRootUrl(baseUrl)
  const model = requireEnv('LIVE_AI_MODEL', ['HELIOS_AI_MODEL'])
  const prompt = readEnv('LIVE_AI_OPERATING_LOOP_PROMPT') ?? DEFAULT_PROMPT

  const models = await listModels(apiBaseUrl, apiKey)
  const responsesSmoke = await runResponsesSmoke(apiBaseUrl, apiKey, model)
  const toolSelection = await runOperatingLoopToolSelection(apiBaseUrl, apiKey, model, prompt)

  const appUrl = readEnv('LIVE_AI_APP_URL')
  const appChat = appUrl
    ? await runAppChatSmoke({
        appUrl: normalizeBaseUrl(appUrl),
        email: readEnv('LIVE_AI_APP_EMAIL') ?? 'admin@acme.com',
        password: readEnv('LIVE_AI_APP_PASSWORD') ?? 'secret',
        provider: readEnv('LIVE_AI_PROVIDER') ?? 'openai',
        model,
        upstreamBaseUrl,
      })
    : { skipped: 'Set LIVE_AI_APP_URL to run the Helios app chat smoke.' }

  console.log(
    JSON.stringify(
      {
        provider: {
          baseUrl: upstreamBaseUrl,
          model,
          modelCount: models.length,
          models,
        },
        responsesSmoke,
        operatingLoopToolSelection: toolSelection,
        appChat,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
