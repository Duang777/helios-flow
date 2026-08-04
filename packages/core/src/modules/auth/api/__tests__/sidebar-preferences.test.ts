/** @jest-environment node */

jest.mock('@helios/shared/lib/auth/server', () => ({
  getAuthFromRequest: jest.fn(),
}))

jest.mock('@helios/shared/lib/i18n/server', () => ({
  resolveTranslations: async () => ({ locale: 'en' }),
}))

jest.mock('@helios/shared/lib/di/container', () => ({
  createRequestContainer: async () => ({ resolve: () => null }),
}))

jest.mock('@helios/shared/lib/encryption/find', () => ({
  findOneWithDecryption: jest.fn(),
  findWithDecryption: jest.fn(),
}))

jest.mock('@helios/core/modules/auth/services/sidebarPreferencesService', () => ({
  loadRoleSidebarPreferences: jest.fn(),
  loadSidebarPreference: jest.fn(),
  saveRoleSidebarPreference: jest.fn(),
  saveSidebarPreference: jest.fn(),
  createSidebarVariant: jest.fn(),
  listSidebarVariants: jest.fn(),
  deleteSidebarVariant: jest.fn(),
  loadSidebarVariant: jest.fn(),
  updateSidebarVariant: jest.fn(),
}))

type MethodMeta = { requireAuth?: boolean; requireFeatures?: string[] }

describe('sidebar preferences/variants gating (issue #1792)', () => {
  it('preferences PUT requires auth.sidebar.manage', async () => {
    const mod = await import('@helios/core/modules/auth/api/sidebar/preferences/route')
    const metadata = mod.metadata as Record<string, MethodMeta>
    expect(metadata.PUT.requireAuth).toBe(true)
    expect(metadata.PUT.requireFeatures).toEqual(['auth.sidebar.manage'])
  })

  it('preferences DELETE requires auth.sidebar.manage', async () => {
    const mod = await import('@helios/core/modules/auth/api/sidebar/preferences/route')
    const metadata = mod.metadata as Record<string, MethodMeta>
    expect(metadata.DELETE.requireAuth).toBe(true)
    expect(metadata.DELETE.requireFeatures).toEqual(['auth.sidebar.manage'])
  })

  it('preferences GET stays open to authenticated users (no manage feature required)', async () => {
    const mod = await import('@helios/core/modules/auth/api/sidebar/preferences/route')
    const metadata = mod.metadata as Record<string, MethodMeta>
    expect(metadata.GET.requireAuth).toBe(true)
    expect(metadata.GET.requireFeatures).toBeUndefined()
  })

  it('variants POST requires auth.sidebar.manage', async () => {
    const mod = await import('@helios/core/modules/auth/api/sidebar/variants/route')
    const metadata = mod.metadata as Record<string, MethodMeta>
    expect(metadata.POST.requireAuth).toBe(true)
    expect(metadata.POST.requireFeatures).toEqual(['auth.sidebar.manage'])
  })

  it('variants [id] PUT and DELETE require auth.sidebar.manage', async () => {
    const mod = await import('@helios/core/modules/auth/api/sidebar/variants/[id]/route')
    const metadata = mod.metadata as Record<string, MethodMeta>
    expect(metadata.PUT.requireAuth).toBe(true)
    expect(metadata.PUT.requireFeatures).toEqual(['auth.sidebar.manage'])
    expect(metadata.DELETE.requireAuth).toBe(true)
    expect(metadata.DELETE.requireFeatures).toEqual(['auth.sidebar.manage'])
  })
})

describe('sidebar customization page metadata (issue #1792)', () => {
  it('declares requireFeatures: [auth.sidebar.manage]', async () => {
    const mod = await import('@helios/core/modules/auth/backend/sidebar-customization/page.meta')
    const metadata = mod.metadata as { requireAuth?: boolean; requireFeatures?: string[] }
    expect(metadata.requireAuth).toBe(true)
    expect(metadata.requireFeatures).toEqual(['auth.sidebar.manage'])
  })
})
