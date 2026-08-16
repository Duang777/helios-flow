import { resolveForcedLocale, resolveRequestLocale, shouldDetectBrowserLocale } from '../locale'

describe('resolveForcedLocale', () => {
  it('returns null when HELIOS_FORCE_LOCALE is unset (default: no forcing)', () => {
    expect(resolveForcedLocale({})).toBeNull()
    expect(resolveForcedLocale({ HELIOS_FORCE_LOCALE: '' })).toBeNull()
    expect(resolveForcedLocale({ HELIOS_FORCE_LOCALE: undefined })).toBeNull()
  })

  it('returns the forced locale when set to a supported value', () => {
    expect(resolveForcedLocale({ HELIOS_FORCE_LOCALE: 'pl' })).toBe('pl')
    expect(resolveForcedLocale({ HELIOS_FORCE_LOCALE: 'de' })).toBe('de')
  })

  it('normalizes region and casing to a supported base locale', () => {
    expect(resolveForcedLocale({ HELIOS_FORCE_LOCALE: 'PL' })).toBe('pl')
    expect(resolveForcedLocale({ HELIOS_FORCE_LOCALE: 'pl-PL' })).toBe('pl')
    expect(resolveForcedLocale({ HELIOS_FORCE_LOCALE: 'en_US' })).toBe('en')
  })

  it('returns null for unsupported locales rather than forcing garbage', () => {
    expect(resolveForcedLocale({ HELIOS_FORCE_LOCALE: 'fr' })).toBeNull()
    expect(resolveForcedLocale({ HELIOS_FORCE_LOCALE: 'not-a-locale' })).toBeNull()
  })
})

describe('shouldDetectBrowserLocale', () => {
  it('is disabled by default so deployments keep the product default language', () => {
    expect(shouldDetectBrowserLocale({})).toBe(false)
    expect(shouldDetectBrowserLocale({ HELIOS_DETECT_BROWSER_LOCALE: '' })).toBe(false)
    expect(shouldDetectBrowserLocale({ HELIOS_DETECT_BROWSER_LOCALE: 'false' })).toBe(false)
  })

  it('can be enabled explicitly', () => {
    expect(shouldDetectBrowserLocale({ HELIOS_DETECT_BROWSER_LOCALE: 'true' })).toBe(true)
    expect(shouldDetectBrowserLocale({ HELIOS_DETECT_BROWSER_LOCALE: '1' })).toBe(true)
    expect(shouldDetectBrowserLocale({ HELIOS_DETECT_BROWSER_LOCALE: 'yes' })).toBe(true)
  })
})

describe('resolveRequestLocale', () => {
  it('defaults to Chinese when no explicit preference is present', () => {
    expect(resolveRequestLocale({ env: {}, acceptLanguage: 'en-US,en;q=0.9' })).toBe('zh')
  })

  it('uses a valid locale cookie before the product default', () => {
    expect(resolveRequestLocale({ env: {}, cookieLocale: 'en', acceptLanguage: 'zh-CN,zh;q=0.9' })).toBe('en')
  })

  it('uses the forced locale before the cookie', () => {
    expect(resolveRequestLocale({ env: { HELIOS_FORCE_LOCALE: 'zh' }, cookieLocale: 'en' })).toBe('zh')
  })

  it('uses Accept-Language only when browser locale detection is enabled', () => {
    expect(
      resolveRequestLocale({
        env: { HELIOS_DETECT_BROWSER_LOCALE: 'true' },
        acceptLanguage: 'de-DE,de;q=0.9,en;q=0.8',
      }),
    ).toBe('de')
  })
})
