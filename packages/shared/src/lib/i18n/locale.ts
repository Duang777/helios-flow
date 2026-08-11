import { defaultLocale, locales, type Locale } from './config'

function normalizeLocaleToken(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, '-')
}

export function resolveSupportedLocale(value: string | null | undefined): Locale | null {
  if (typeof value !== 'string') return null

  const normalized = normalizeLocaleToken(value)
  if (!normalized) return null

  if (locales.includes(normalized as Locale)) {
    return normalized as Locale
  }

  const baseLocale = normalized.split('-')[0]
  if (baseLocale && locales.includes(baseLocale as Locale)) {
    return baseLocale as Locale
  }

  return null
}

export function resolveLocaleFromCandidates(
  candidates: Iterable<string | null | undefined>,
): Locale | null {
  for (const candidate of candidates) {
    const resolved = resolveSupportedLocale(candidate)
    if (resolved) return resolved
  }
  return null
}

/**
 * Reads the optional `HELIOS_FORCE_LOCALE` env override. When set to a supported
 * locale (e.g. `pl`), the whole app is pinned to it and cookie/Accept-Language
 * detection is bypassed. Unset (the default) → `null` → normal detection.
 * Pure: pass the env bag so it stays testable and safe to call server-side only.
 */
export function resolveForcedLocale(
  env: Record<string, string | undefined>,
): Locale | null {
  return resolveSupportedLocale(env.HELIOS_FORCE_LOCALE)
}

export function shouldDetectBrowserLocale(
  env: Record<string, string | undefined>,
): boolean {
  const raw = env.HELIOS_DETECT_BROWSER_LOCALE?.trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export function resolveRequestLocale(input: {
  env: Record<string, string | undefined>
  cookieLocale?: string | null
  acceptLanguage?: string | null
}): Locale {
  const forced = resolveForcedLocale(input.env)
  if (forced) return forced

  const cookieLocale = resolveSupportedLocale(input.cookieLocale)
  if (cookieLocale) return cookieLocale

  if (shouldDetectBrowserLocale(input.env)) {
    const browserLocale = resolveLocaleFromAcceptLanguage(input.acceptLanguage)
    if (browserLocale) return browserLocale
  }

  return defaultLocale
}

export function resolveLocaleFromAcceptLanguage(
  acceptLanguage: string | null | undefined,
): Locale | null {
  if (typeof acceptLanguage !== 'string' || acceptLanguage.trim().length === 0) {
    return null
  }

  const rankedCandidates = acceptLanguage
    .split(',')
    .map((entry, index) => {
      const [rawLocale, ...rawParams] = entry.split(';')
      const locale = rawLocale?.trim() ?? ''
      const qParam = rawParams.find((param) => param.trim().startsWith('q='))
      const parsedQ = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1
      const quality = Number.isFinite(parsedQ) ? Math.min(Math.max(parsedQ, 0), 1) : 1

      return { locale, quality, index }
    })
    .filter((entry) => entry.locale.length > 0 && entry.quality > 0)
    .sort((left, right) => {
      if (right.quality !== left.quality) {
        return right.quality - left.quality
      }
      return left.index - right.index
    })

  return resolveLocaleFromCandidates(rankedCandidates.map((entry) => entry.locale))
}
