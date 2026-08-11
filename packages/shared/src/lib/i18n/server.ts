import type { Locale } from './config'
import type { Dict } from './context'
import { resolveRequestLocale } from './locale'
import { createFallbackTranslator, createTranslator } from './translate'
import { getModules } from '../modules/registry'
import { loadAppDictionary } from './app-dictionaries'
import { getCachedDictionary, setCachedDictionary } from './dictionary-cache'

// Re-export for backwards compatibility
export { registerModules, getModules } from '../modules/registry'
export { registerAppDictionaryLoader } from './app-dictionaries'
export { invalidateDictionaryCache } from './dictionary-cache'

function flattenDictionary(source: unknown, prefix = ''): Dict {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}
  const result: Dict = {}
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (!key) continue
    const nextKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      result[nextKey] = value
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenDictionary(value, nextKey))
    }
  }
  return result
}

export async function detectLocale(): Promise<Locale> {
  // Ops-level override and user cookie are explicit preferences. Browser
  // detection stays opt-in so the product default remains Chinese.
  let cookieLocale: string | null = null
  let acceptLanguage: string | null = null
  // Dynamic import to avoid requiring Next.js in non-Next.js contexts (CLI, tests)
  try {
    const { cookies, headers } = await import('next/headers')
    try {
      cookieLocale = (await cookies()).get('locale')?.value ?? null
    } catch {
      // cookies() may not be available outside request context (e.g., in tests)
    }
    try {
      acceptLanguage = (await headers()).get('accept-language') ?? null
    } catch {
      // headers() may not be available outside request context (e.g., in tests)
    }
  } catch {
    // next/headers not available (CLI context)
  }
  return resolveRequestLocale({ env: process.env, cookieLocale, acceptLanguage })
}

export async function loadDictionary(locale: Locale): Promise<Dict> {
  // Locale dictionaries are immutable at runtime, so the flatten+merge below
  // only needs to run once per locale. The cache is invalidated whenever
  // modules or the app dictionary loader are (re)registered.
  const cached = getCachedDictionary(locale)
  if (cached) return cached
  // Load from registry instead of @/ import (works in standalone packages)
  const baseRaw = await loadAppDictionary(locale)
  const merged: Dict = { ...flattenDictionary(baseRaw) }
  const modules = getModules()
  for (const m of modules) {
    const dict = m.translations?.[locale]
    if (dict) Object.assign(merged, flattenDictionary(dict))
  }
  setCachedDictionary(locale, merged)
  return merged
}

export async function resolveTranslations() {
  const locale = await detectLocale()
  const dict = await loadDictionary(locale)
  const t = createTranslator(dict)
  const translate = createFallbackTranslator(dict)
  return { locale, dict, t, translate }
}
// Hint Next.js to keep this server-only; ignore if unavailable when running scripts outside Next.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('server-only')
} catch {
  // noop: allows running generator scripts without Next's server-only package
}
