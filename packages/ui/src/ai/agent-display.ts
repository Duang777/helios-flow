import type { TranslateFn } from '@helios/shared/lib/i18n/context'

export interface AiAgentDisplayMetadata {
  label: string
  description?: string | null
  labelKey?: string | null
  descriptionKey?: string | null
}

function resolveTranslatedText(
  t: TranslateFn,
  key: string | null | undefined,
  fallback: string,
): string {
  if (!key) return fallback
  return t(key, fallback)
}

export function resolveAiAgentLabel(
  agent: AiAgentDisplayMetadata,
  t: TranslateFn,
): string {
  return resolveTranslatedText(t, agent.labelKey, agent.label)
}

export function resolveAiAgentDescription(
  agent: AiAgentDisplayMetadata,
  t: TranslateFn,
): string | null {
  const fallback = agent.description ?? ''
  const resolved = resolveTranslatedText(t, agent.descriptionKey, fallback).trim()
  return resolved.length > 0 ? resolved : null
}
