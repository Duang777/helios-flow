// bootstrap.ts pulls in sibling packages that have no jest module mapping in
// this workspace; getCachedCacheService only needs the real @helios/cache,
// so stub the rest to keep the unit test focused and resolvable.
jest.mock('@helios/events/index', () => ({ createEventBus: jest.fn() }), { virtual: true })
jest.mock('@helios/search', () => ({
  registerSearchModule: jest.fn(),
  createSearchDeleteSubscriber: jest.fn(),
  searchDeleteMetadata: {},
}), { virtual: true })

import { getCachedCacheService } from '../bootstrap'

const CACHE_GLOBAL_KEY = '__heliosCacheService__'
const CACHE_SHUTDOWN_KEY = '__heliosCacheShutdown__'

describe('getCachedCacheService', () => {
  const originalSingletonEnv = process.env.HELIOS_CACHE_SINGLETON
  const originalStrategy = process.env.CACHE_STRATEGY

  beforeEach(() => {
    delete (globalThis as Record<string, unknown>)[CACHE_GLOBAL_KEY]
    delete (globalThis as Record<string, unknown>)[CACHE_SHUTDOWN_KEY]
    delete process.env.HELIOS_CACHE_SINGLETON
    process.env.CACHE_STRATEGY = 'memory'
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)[CACHE_GLOBAL_KEY]
    delete (globalThis as Record<string, unknown>)[CACHE_SHUTDOWN_KEY]
    if (originalSingletonEnv === undefined) delete process.env.HELIOS_CACHE_SINGLETON
    else process.env.HELIOS_CACHE_SINGLETON = originalSingletonEnv
    if (originalStrategy === undefined) delete process.env.CACHE_STRATEGY
    else process.env.CACHE_STRATEGY = originalStrategy
  })

  it('returns the same instance across calls so caches survive request containers', () => {
    const first = getCachedCacheService()
    const second = getCachedCacheService()
    expect(first).not.toBeNull()
    expect(second).toBe(first)
  })

  it('returns a working cache strategy', async () => {
    const cache = getCachedCacheService()
    expect(cache).not.toBeNull()
    await cache!.set('singleton-key', 'singleton-value')
    expect(await cache!.get('singleton-key')).toBe('singleton-value')
  })

  it('returns null when disabled via the HELIOS_CACHE_SINGLETON escape hatch', () => {
    process.env.HELIOS_CACHE_SINGLETON = 'off'
    expect(getCachedCacheService()).toBeNull()
  })

  it('treats an unset HELIOS_CACHE_SINGLETON as enabled', () => {
    expect(getCachedCacheService()).not.toBeNull()
  })
})
