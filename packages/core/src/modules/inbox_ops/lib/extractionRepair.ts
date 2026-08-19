const ACTION_TYPES = new Set([
  'create_order',
  'create_quote',
  'update_order',
  'update_shipment',
  'create_contact',
  'create_product',
  'link_contact',
  'log_activity',
  'draft_reply',
])

function stripMarkdownFence(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced?.[1]?.trim() ?? trimmed
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stringifyPayload(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return '{}'
    }
  }
  return '{}'
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function coerceConfidence(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  if (!Number.isFinite(parsed)) return 0
  if (parsed < 0) return 0
  if (parsed > 1) return 1
  return parsed
}

function repairAction(value: unknown): Record<string, unknown> | null {
  const action = asRecord(value)
  if (!action) return null
  const actionType = String(action.actionType ?? '')
  if (!ACTION_TYPES.has(actionType)) return null
  const payloadSource = action.payloadJson ?? action.payload
  return {
    ...action,
    actionType,
    description: String(action.description ?? actionType),
    confidence: coerceConfidence(action.confidence),
    payloadJson: stringifyPayload(payloadSource),
  }
}

function repairParticipant(value: unknown): Record<string, unknown> | null {
  const participant = asRecord(value)
  if (!participant) return null
  const name = String(participant.name ?? '').trim()
  if (!name) return null
  return {
    name,
    email: String(participant.email ?? ''),
    role: participant.role,
  }
}

/**
 * Coerce common LLM extraction JSON failures into the shape Zod expects.
 * Used by generateObject `experimental_repairText` after schema mismatch.
 */
export function repairExtractionJsonText(text: string): string {
  const stripped = stripMarkdownFence(text)
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped) as unknown
  } catch {
    const start = stripped.indexOf('{')
    const end = stripped.lastIndexOf('}')
    if (start < 0 || end <= start) return stripped
    try {
      parsed = JSON.parse(stripped.slice(start, end + 1)) as unknown
    } catch {
      return stripped
    }
  }

  const record = asRecord(parsed)
  if (!record) return stripped

  const proposedActions = asArray(record.proposedActions)
    .map(repairAction)
    .filter((action): action is Record<string, unknown> => action !== null)
  const participants = asArray(record.participants)
    .map(repairParticipant)
    .filter((participant): participant is Record<string, unknown> => participant !== null)

  const repaired = {
    ...record,
    summary: String(record.summary ?? ''),
    participants,
    proposedActions,
    discrepancies: asArray(record.discrepancies),
    draftReplies: asArray(record.draftReplies),
    confidence: coerceConfidence(record.confidence),
  }

  return JSON.stringify(repaired)
}
