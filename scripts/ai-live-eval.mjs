#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import {
  OPERATING_LOOP_ACCEPTANCE_PROMPTS,
  OPERATING_LOOP_AGENT_ID,
  OPERATING_LOOP_REQUIRED_TOOLS,
  assertOperatingLoopAnswerQuality,
  evaluateOperatingLoopAnswer,
  extractAssistantTextFromSse,
  extractToolCallSequence,
  normalizeToolName,
} from './lib/operating-loop-acceptance.mjs'

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

function readPositiveIntegerEnv(name, fallback) {
  const value = readEnv(name)
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
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
  return parseJsonText(text)
}

function parseJsonText(text) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`[ai-live-eval] Expected JSON, got: ${text.slice(0, 500)}`)
  }
}

async function fetchTextWithTimeout(url, init, { label, timeoutMs }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const text = await response.text()
    return { response, text }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`[ai-live-eval] ${label} timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function hasTerminalSseEvent(raw) {
  for (const block of String(raw ?? '').split(/\r?\n\r?\n/)) {
    const payload = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n')
    if (!payload || payload === '[DONE]') {
      if (payload === '[DONE]') return true
      continue
    }
    try {
      const parsed = JSON.parse(payload)
      if (
        parsed?.type === 'loop-finish' ||
        parsed?.type === 'finish' ||
        parsed?.type === 'done' ||
        parsed?.type === 'response.completed'
      ) {
        return true
      }
    } catch {
      // Keep reading; provider text chunks are not always JSON.
    }
  }
  return false
}

async function fetchSseWithTimeout(url, init, { label, timeoutMs, stopWhenRaw = null }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let reader = null
  let text = ''
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.body) {
      return { response, text: await response.text(), sawTerminalEvent: false }
    }

    const decoder = new TextDecoder()
    let sawTerminalEvent = false
    reader = response.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
      if (
        hasTerminalSseEvent(text) ||
        (typeof stopWhenRaw === 'function' && stopWhenRaw(text))
      ) {
        sawTerminalEvent = true
        await reader.cancel().catch(() => undefined)
        break
      }
    }
    text += decoder.decode()
    return { response, text, sawTerminalEvent }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const toolCalls = extractToolCallSequence(text)
      const assistantText = extractAssistantTextFromSse(text)
      throw new Error(
        `[ai-live-eval] ${label} timed out after ${timeoutMs}ms (partialTools=${toolCalls.join(',') || 'none'}, partialTextChars=${assistantText.length})`,
      )
    }
    throw error
  } finally {
    clearTimeout(timeout)
    if (reader) await reader.releaseLock()
  }
}

async function providerFetch(baseUrl, apiKey, path, init = {}) {
  const { response, text } = await fetchTextWithTimeout(
    `${baseUrl}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    },
    {
      label: `provider ${path}`,
      timeoutMs: readPositiveIntegerEnv('LIVE_AI_PROVIDER_REQUEST_TIMEOUT_MS', 45_000),
    },
  )
  const json = parseJsonText(text)
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
  const calledNames = calls.map((call) => normalizeToolName(call.name))
  const missing = OPERATING_LOOP_REQUIRED_TOOLS.filter((toolName) => !calledNames.includes(toolName))
  if (missing.length > 0) {
    throw new Error(
      `[ai-live-eval] Operating-loop tool selection missed required tools: ${missing.join(', ')}`,
    )
  }
  return { id: json.id ?? null, calls, normalizedCalls: calledNames }
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

async function runAppChatSmoke({ appUrl, email, password, provider, model, upstreamBaseUrl }) {
  const token = await loginApp(appUrl, email, password)
  const url = new URL(`${appUrl}/api/ai_assistant/ai/chat`)
  url.searchParams.set('agent', readEnv('LIVE_AI_AGENT') ?? OPERATING_LOOP_AGENT_ID)
  url.searchParams.set('provider', provider)
  url.searchParams.set('model', model)
  if (readEnv('LIVE_AI_APP_BASE_URL_OVERRIDE') === '1') {
    url.searchParams.set('baseUrl', `${upstreamBaseUrl}/v1`)
  }

  const { response, text: raw } = await fetchSseWithTimeout(
    url,
    {
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
    },
    {
      label: 'app chat smoke',
      timeoutMs: readPositiveIntegerEnv('LIVE_AI_APP_REQUEST_TIMEOUT_MS', 90_000),
      stopWhenRaw: (raw) => extractAssistantTextFromSse(raw).includes('Operating Loop Assistant'),
    },
  )
  if (!response.ok) {
    throw new Error(`[ai-live-eval] App chat failed (${response.status}): ${raw.slice(0, 500)}`)
  }
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    text: extractAssistantTextFromSse(raw).slice(0, 500),
  }
}

async function runAppOperatingLoopAcceptance({
  appUrl,
  email,
  password,
  provider,
  model,
  upstreamBaseUrl,
  pageContext,
}) {
  const token = await loginApp(appUrl, email, password)
  const results = []
  const continueOnFail = readEnv('LIVE_AI_ACCEPTANCE_CONTINUE_ON_FAIL') === '1'
  const promptFilter = (readEnv('LIVE_AI_ACCEPTANCE_PROMPT_IDS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const promptCases = promptFilter.length
    ? OPERATING_LOOP_ACCEPTANCE_PROMPTS.filter((promptCase) => promptFilter.includes(promptCase.id))
    : OPERATING_LOOP_ACCEPTANCE_PROMPTS
  if (promptFilter.length && promptCases.length === 0) {
    throw new Error(
      `[ai-live-eval] LIVE_AI_ACCEPTANCE_PROMPT_IDS matched no prompts: ${promptFilter.join(',')}`,
    )
  }
  const baseTimeoutMs = readPositiveIntegerEnv('LIVE_AI_APP_REQUEST_TIMEOUT_MS', 240_000)

  for (const promptCase of promptCases) {
    const url = new URL(`${appUrl}/api/ai_assistant/ai/chat`)
    url.searchParams.set('agent', readEnv('LIVE_AI_AGENT') ?? OPERATING_LOOP_AGENT_ID)
    url.searchParams.set('provider', provider)
    url.searchParams.set('model', model)
    if (readEnv('LIVE_AI_APP_BASE_URL_OVERRIDE') === '1') {
      url.searchParams.set('baseUrl', `${upstreamBaseUrl}/v1`)
    }

    const toolCount = promptCase.requiredTools?.length ?? 0
    const toolBudgetMs = Math.max(
      baseTimeoutMs,
      120_000 + toolCount * 30_000,
      toolCount >= 5 ? 300_000 : 0,
    )

    let response
    let raw
    try {
      ;({ response, text: raw } = await fetchSseWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: promptCase.prompt }],
            debug: true,
            ...(pageContext ? { pageContext } : {}),
          }),
        },
        {
          label: `app operating-loop prompt ${promptCase.id}`,
          timeoutMs: toolBudgetMs,
          stopWhenRaw: (rawText) =>
            evaluateOperatingLoopAnswer({
              text: extractAssistantTextFromSse(rawText),
              toolCalls: extractToolCallSequence(rawText),
              promptCase,
            }).passed,
        },
      ))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!continueOnFail) throw error
      results.push({
        id: promptCase.id,
        prompt: promptCase.prompt,
        text: '',
        toolCalls: [],
        quality: { passed: false, error: message },
      })
      console.error(message)
      continue
    }

    if (!response.ok) {
      const message = `[ai-live-eval] App operating-loop prompt ${promptCase.id} failed (${response.status}): ${raw.slice(0, 500)}`
      if (!continueOnFail) throw new Error(message)
      results.push({
        id: promptCase.id,
        prompt: promptCase.prompt,
        text: raw.slice(0, 1000),
        toolCalls: [],
        quality: { passed: false, error: message },
      })
      console.error(message)
      continue
    }
    const text = extractAssistantTextFromSse(raw)
    const toolCalls = extractToolCallSequence(raw)
    let quality
    try {
      quality = assertOperatingLoopAnswerQuality({ text, toolCalls, promptCase })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const full = `[ai-live-eval] App operating-loop prompt ${promptCase.id} failed quality: ${message}; toolCalls=${toolCalls.join(',') || 'none'}; text=${text.slice(0, 500)}`
      if (!continueOnFail) throw new Error(full)
      results.push({
        id: promptCase.id,
        prompt: promptCase.prompt,
        text: text.slice(0, 1000),
        toolCalls,
        quality: { passed: false, error: full },
      })
      console.error(full)
      continue
    }
    results.push({
      id: promptCase.id,
      prompt: promptCase.prompt,
      text: text.slice(0, 1000),
      toolCalls,
      quality,
    })
  }
  const failed = results.filter((entry) => entry.quality?.passed === false)
  if (failed.length > 0 && continueOnFail) {
    process.exitCode = 1
  }
  return results
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
  const projectId = readEnv('LIVE_AI_PROJECT_ID')
  const organizationId = readEnv('LIVE_AI_ORGANIZATION_ID')
  const pageContext = projectId
    ? {
        entityType: 'projects.project',
        recordType: 'project',
        recordId: projectId,
        organizationId: organizationId ?? undefined,
      }
    : null
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
  const appOperatingLoopAcceptance = appUrl
    ? await runAppOperatingLoopAcceptance({
        appUrl: normalizeBaseUrl(appUrl),
        email: readEnv('LIVE_AI_APP_EMAIL') ?? 'admin@acme.com',
        password: readEnv('LIVE_AI_APP_PASSWORD') ?? 'secret',
        provider: readEnv('LIVE_AI_PROVIDER') ?? 'openai',
        model,
        upstreamBaseUrl,
        pageContext,
      })
    : { skipped: 'Set LIVE_AI_APP_URL to run the Helios operating-loop acceptance prompts.' }

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
        appOperatingLoopAcceptance,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? ` cause=${error.cause.message}` : ''
    console.error(`${error.message}${cause}`)
  } else {
    console.error(String(error))
  }
  process.exitCode = 1
})
