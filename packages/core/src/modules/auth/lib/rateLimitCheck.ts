import { NextResponse } from 'next/server'
import { getCachedRateLimiterService } from '@helios/core/bootstrap'
import { checkRateLimit, getClientIp, RATE_LIMIT_ERROR_KEY, RATE_LIMIT_ERROR_FALLBACK, RATE_LIMIT_FALLBACK_KEY } from '@helios/shared/lib/ratelimit/helpers'
import type { RateLimitConfig } from '@helios/shared/lib/ratelimit/types'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { computeEmailHash } from '@helios/core/modules/auth/lib/emailHash'

export interface CheckAuthRateLimitOptions {
  req: Request
  ipConfig: RateLimitConfig
  compoundConfig?: RateLimitConfig
  /** Raw identifier for compound key (e.g., email). Hashed internally before use. */
  compoundIdentifier?: string
}

export interface CheckAuthRateLimitResult {
  error: NextResponse | null
  compoundKey: string | null
}

/**
 * Fail-open rate limit check for auth endpoints.
 * Layer 1: IP-only check with ipConfig.
 * Layer 2 (optional): compound IP + hashed identifier check with compoundConfig.
 */
export async function checkAuthRateLimit(options: CheckAuthRateLimitOptions): Promise<CheckAuthRateLimitResult> {
  try {
    const isIntegrationTestMode = process.env.HELIOS_TEST_MODE === '1' && process.env.HELIOS_TEST_AUTH_RATE_LIMIT_MODE === 'opt-in'
    if (isIntegrationTestMode) {
      const rateLimitHeader = options.req.headers.get('x-helios-test-rate-limit')
      if (rateLimitHeader !== 'on') {
        return { error: null, compoundKey: null }
      }
    }

    const rateLimiterService = getCachedRateLimiterService()
    if (!rateLimiterService) return { error: null, compoundKey: null }

    const clientIp = getClientIp(options.req, rateLimiterService.trustProxyDepth)
    const clientKey = clientIp ?? RATE_LIMIT_FALLBACK_KEY

    const { translate } = await resolveTranslations()
    const errorMessage = translate(RATE_LIMIT_ERROR_KEY, RATE_LIMIT_ERROR_FALLBACK)

    const ipError = await checkRateLimit(rateLimiterService, options.ipConfig, clientKey, errorMessage)
    if (ipError) return { error: ipError, compoundKey: null }

    if (options.compoundConfig && options.compoundIdentifier) {
      const hash = computeEmailHash(options.compoundIdentifier)
      const compoundKey = `${clientKey}:${hash}`
      const compoundError = await checkRateLimit(rateLimiterService, options.compoundConfig, compoundKey, errorMessage)
      if (compoundError) return { error: compoundError, compoundKey }
      return { error: null, compoundKey }
    }

    return { error: null, compoundKey: null }
  } catch {
    return { error: null, compoundKey: null }
  }
}

/**
 * Best-effort reset of a compound rate-limit key after successful authentication.
 * Never throws — wrapped in try/catch.
 */
export async function resetAuthRateLimit(compoundKey: string, config: RateLimitConfig): Promise<void> {
  try {
    const rateLimiterService = getCachedRateLimiterService()
    if (rateLimiterService) {
      await rateLimiterService.delete(compoundKey, config)
    }
  } catch {
    // best-effort — don't fail the request if counter reset fails
  }
}
