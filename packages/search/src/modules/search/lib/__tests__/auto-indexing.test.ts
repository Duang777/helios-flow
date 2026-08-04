import { envDisablesAutoIndexing, resolveAutoIndexingEnabled } from '../auto-indexing'

describe('search auto-indexing env overrides', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.HELIOS_DISABLE_VECTOR_SEARCH_AUTOINDEXING
    delete process.env.DISABLE_VECTOR_SEARCH_AUTOINDEXING
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('uses the HELIOS_ env name to disable auto-indexing', () => {
    process.env.HELIOS_DISABLE_VECTOR_SEARCH_AUTOINDEXING = 'true'

    expect(envDisablesAutoIndexing()).toBe(true)
  })

  it('keeps the legacy env alias working', () => {
    process.env.DISABLE_VECTOR_SEARCH_AUTOINDEXING = '1'

    expect(envDisablesAutoIndexing()).toBe(true)
  })

  it('prefers the HELIOS_ env name when both aliases are set', () => {
    process.env.HELIOS_DISABLE_VECTOR_SEARCH_AUTOINDEXING = 'false'
    process.env.DISABLE_VECTOR_SEARCH_AUTOINDEXING = '1'

    expect(envDisablesAutoIndexing()).toBe(false)
  })

  it('forces auto-indexing off before module config is consulted', async () => {
    process.env.HELIOS_DISABLE_VECTOR_SEARCH_AUTOINDEXING = 'true'
    const resolve = jest.fn().mockReturnValue({
      getValue: jest.fn().mockResolvedValue(true),
    })

    await expect(resolveAutoIndexingEnabled({ resolve })).resolves.toBe(false)
    expect(resolve).not.toHaveBeenCalled()
  })
})
