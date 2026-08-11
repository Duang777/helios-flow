export const OPERATING_LOOP_AGENT_ID = 'insights.operating_loop_assistant'

export const OPERATING_LOOP_REQUIRED_TOOLS = [
  'projects.get_delay_summary',
  'commercial.get_project_settlement_summary',
  'insights.get_kpi_gap',
  'governance.list_findings',
]

export const OPERATING_LOOP_ACCEPTANCE_PROMPTS = [
  {
    id: 'zh_project_loop',
    prompt:
      '这个项目延期了吗？合同回款怎样？KPI 差多少？有哪些治理检出？请给出数字、公式来源、证据 ID 和后台链接。',
    requiredTools: OPERATING_LOOP_REQUIRED_TOOLS,
    requiredMarkers: ['延期', '回款', 'KPI', '治理'],
  },
  {
    id: 'zh_overdue_ar',
    prompt:
      '列出当前逾期应收，说明逾期未回金额怎么算，并给出可以打开的后台链接。',
    requiredTools: ['commercial.list_overdue_invoices', 'commercial.explain_metric'],
    requiredMarkers: ['逾期', '应收', '公式'],
  },
  {
    id: 'zh_governance_disposition',
    prompt:
      '有哪些 critical 治理检出？解释触发规则、证据 ID、负责人角色，并给出处置建议。',
    requiredTools: ['governance.list_findings', 'governance.explain_rule', 'governance.suggest_disposition'],
    requiredMarkers: ['critical', '证据', '负责人'],
  },
]

export function normalizeToolName(name) {
  return String(name ?? '').replace(/__/g, '.')
}

export function extractToolCallSequence(sse) {
  const toolNames = []
  for (const rawLine of String(sse ?? '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const parsed = JSON.parse(payload)
      if (parsed?.type === 'tool-input-start' && typeof parsed.toolName === 'string') {
        toolNames.push(normalizeToolName(parsed.toolName))
      } else if (parsed?.type === 'function_call' && typeof parsed.name === 'string') {
        toolNames.push(normalizeToolName(parsed.name))
      }
    } catch {
      // Ignore provider text chunks and non-JSON keep-alives.
    }
  }
  return toolNames
}

export function extractAssistantTextFromSse(sse) {
  const chunks = []
  for (const rawLine of String(sse ?? '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const parsed = JSON.parse(payload)
      if (parsed?.type === 'text-delta' && typeof parsed.delta === 'string') {
        chunks.push(parsed.delta)
      } else if (parsed?.type === 'text' && typeof parsed.content === 'string') {
        chunks.push(parsed.content)
      } else if (parsed?.type === 'text-start' && typeof parsed.text === 'string') {
        chunks.push(parsed.text)
      } else if (!parsed?.type && typeof parsed.content === 'string') {
        chunks.push(parsed.content)
      }
    } catch {
      // Plain text chunks are rare in the app stream, but provider proxies may emit them.
      if (!payload.startsWith('{')) chunks.push(payload)
    }
  }
  return chunks.join('')
}

function containsAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text))
}

export function evaluateOperatingLoopAnswer({ text, toolCalls, promptCase }) {
  const normalizedText = String(text ?? '')
  const calls = Array.isArray(toolCalls) ? toolCalls.map(normalizeToolName) : []
  const requiredTools = promptCase?.requiredTools ?? OPERATING_LOOP_REQUIRED_TOOLS
  const missingTools = requiredTools.filter((tool) => !calls.includes(tool))
  const missingMarkers = (promptCase?.requiredMarkers ?? []).filter(
    (marker) => !normalizedText.toLowerCase().includes(String(marker).toLowerCase()),
  )
  const checks = {
    hasNumber: containsAny(normalizedText, [/\d+(?:\.\d+)?%?/, /[零一二三四五六七八九十百千万亿]+/]),
    hasFormulaSource: containsAny(normalizedText, [
      /公式/,
      /formula/i,
      /source/i,
      /来源/,
      /commercial\.metrics/,
      /projects\.lib\.milestoneDelay/,
    ]),
    hasBackendHref: /\/backend\//.test(normalizedText),
    hasEvidenceMarker: containsAny(normalizedText, [/evidence/i, /证据/, /finding\.id/i, /检出 ID/, /治理检出/]),
  }
  const failures = []
  if (missingTools.length > 0) failures.push(`missing tools: ${missingTools.join(', ')}`)
  if (missingMarkers.length > 0) failures.push(`missing prompt markers: ${missingMarkers.join(', ')}`)
  for (const [key, passed] of Object.entries(checks)) {
    if (!passed) failures.push(`missing ${key}`)
  }
  return {
    passed: failures.length === 0,
    failures,
    missingTools,
    missingMarkers,
    checks,
    toolCalls: calls,
  }
}

export function assertOperatingLoopAnswerQuality(input) {
  const result = evaluateOperatingLoopAnswer(input)
  if (!result.passed) {
    throw new Error(`[operating-loop-acceptance] ${result.failures.join('; ')}`)
  }
  return result
}
