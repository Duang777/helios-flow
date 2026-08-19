function isUiPartRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseJsonValue(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function unwrapToolOutput(output: unknown): unknown {
  let current = output
  if (typeof current === 'string') {
    const trimmed = current.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return current
    const parsed = parseJsonValue(trimmed)
    if (parsed == null) return current
    current = parsed
  }
  if (!isUiPartRecord(current)) return current
  if ('status' in current || 'uiPart' in current || 'uiParts' in current || 'pendingActionId' in current) {
    return current
  }
  if ('output' in current) return unwrapToolOutput(current.output)
  if ('result' in current) return unwrapToolOutput(current.result)
  if ('value' in current) return unwrapToolOutput(current.value)
  return current
}

export function extractDataPayload(eventBlock: string): string | null {
  const dataLines = eventBlock
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => (line.startsWith('data: ') ? line.slice(6) : line.slice(5)))
  if (dataLines.length === 0) return null
  return dataLines.join('\n')
}

export function extractUiPartsFromToolOutput(output: unknown): Record<string, unknown>[] {
  const parsed = unwrapToolOutput(output)
  if (!isUiPartRecord(parsed)) return []
  const value = parsed
  const parts: Record<string, unknown>[] = []
  if (value.status === 'pending-confirmation' || value.status === 'awaiting-confirmation') {
    const pendingActionId =
      typeof value.pendingActionId === 'string' && value.pendingActionId.length > 0
        ? value.pendingActionId
        : null
    if (pendingActionId) {
      parts.push({
        componentId: 'mutation-preview-card',
        pendingActionId,
        payload: {
          pendingActionId,
          expiresAt: typeof value.expiresAt === 'string' ? value.expiresAt : undefined,
          agentId:
            typeof value.agentId === 'string'
              ? value.agentId
              : typeof value.agent === 'string'
                ? value.agent
                : undefined,
          toolName: typeof value.toolName === 'string' ? value.toolName : undefined,
        },
      })
    }
  }
  if (isUiPartRecord(value.uiPart)) parts.push(value.uiPart)
  if (Array.isArray(value.uiParts)) parts.push(...value.uiParts.filter(isUiPartRecord))
  return parts
}

function looksLikeSse(raw: string, contentType: string | null): boolean {
  if (contentType?.includes('event-stream')) return true
  return /(?:^|\n)data:\s*\{/.test(raw)
}

function collectSseEvents(raw: string): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = []
  for (const block of raw.split(/\r?\n\r?\n/)) {
    const data = extractDataPayload(block)
    if (!data || data === '[DONE]') continue
    const parsed = parseJsonValue(data)
    if (isUiPartRecord(parsed)) events.push(parsed)
  }
  if (events.length > 0) return events

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line.startsWith('data:')) continue
    const payload = line.startsWith('data: ') ? line.slice(6) : line.slice(5)
    if (!payload || payload === '[DONE]') continue
    const parsed = parseJsonValue(payload)
    if (isUiPartRecord(parsed)) events.push(parsed)
  }
  return events
}

export function extractAssistantSnapshot(
  raw: string,
  contentType: string | null,
): { content: string; uiParts: Record<string, unknown>[] } {
  if (!looksLikeSse(raw, contentType)) {
    return { content: raw, uiParts: [] }
  }

  let content = ''
  const uiParts: Record<string, unknown>[] = []
  const seen = new Set<string>()

  const pushParts = (parts: Record<string, unknown>[]) => {
    for (const part of parts) {
      const key =
        typeof part.pendingActionId === 'string'
          ? `${String(part.componentId ?? '')}:${part.pendingActionId}`
          : JSON.stringify(part)
      if (seen.has(key)) continue
      seen.add(key)
      uiParts.push(part)
    }
  }

  for (const parsed of collectSseEvents(raw)) {
    if (parsed.type === 'text-delta' && typeof parsed.delta === 'string') {
      content += parsed.delta
    } else if (parsed.type === 'text' && typeof parsed.content === 'string') {
      content += parsed.content
    } else if (parsed.type === 'tool-output-available') {
      pushParts(extractUiPartsFromToolOutput(parsed.output))
    } else if (parsed.type === 'ui-part' || parsed.componentId === 'mutation-preview-card') {
      pushParts([parsed])
    } else {
      const nested = extractUiPartsFromToolOutput(parsed)
      if (nested.length > 0) pushParts(nested)
    }
  }

  if (uiParts.length === 0) {
    const pendingMatch = raw.match(
      /"pendingActionId"\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})"/i,
    )
    if (pendingMatch?.[1] && /pending-confirmation|awaiting-confirmation/.test(raw)) {
      pushParts([
        {
          componentId: 'mutation-preview-card',
          pendingActionId: pendingMatch[1],
          payload: { pendingActionId: pendingMatch[1] },
        },
      ])
    }
  }

  return { content, uiParts }
}

