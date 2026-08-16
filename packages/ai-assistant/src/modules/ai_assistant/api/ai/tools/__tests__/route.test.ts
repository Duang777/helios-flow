const authMock = jest.fn()
const createRequestContainerMock = jest.fn()
const hasRequiredFeaturesMock = jest.fn()
const ensureAllModuleToolsLoadedMock = jest.fn()
const toolRegistryMock = { getTools: jest.fn() }
const rbacService = { loadAcl: jest.fn() }

jest.mock('@helios/shared/lib/auth/server', () => ({
  getAuthFromRequest: (...args: unknown[]) => authMock(...args),
}))

jest.mock('@helios/shared/lib/di/container', () => ({
  createRequestContainer: (...args: unknown[]) => createRequestContainerMock(...args),
}))

jest.mock('../../../../lib/tool-registry', () => ({
  toolRegistry: toolRegistryMock,
}))

jest.mock('../../../../lib/tool-loader', () => ({
  ensureAllModuleToolsLoaded: (...args: unknown[]) => ensureAllModuleToolsLoadedMock(...args),
}))

jest.mock('../../../../lib/auth', () => ({
  hasRequiredFeatures: (...args: unknown[]) => hasRequiredFeaturesMock(...args),
}))

import { GET } from '../route'

function buildRequest(): Request {
  return new Request('http://localhost/api/ai_assistant/ai/tools', { method: 'GET' })
}

const sampleTools = new Map<string, any>([
  [
    'catalog.update_product',
    {
      name: 'catalog.update_product',
      moduleId: 'catalog',
      displayName: 'Update product',
      description: 'Update a product record',
      tags: ['write', 'catalog'],
      isMutation: true,
      isBulk: false,
      isDestructive: false,
      requiredFeatures: ['catalog.products.manage'],
    },
  ],
  [
    'catalog.bulk_delete_products',
    {
      name: 'catalog.bulk_delete_products',
      moduleId: 'catalog',
      displayName: 'Bulk delete products',
      description: 'Delete many products at once',
      tags: ['write', 'catalog', 'bulk'],
      isMutation: true,
      isBulk: true,
      isDestructive: () => true,
      requiredFeatures: ['catalog.products.manage'],
    },
  ],
  [
    'customers.search',
    {
      name: 'customers.search',
      moduleId: 'customers',
      displayName: 'Search customers',
      description: 'Search the customer directory',
      tags: ['read', 'customers'],
      isMutation: false,
      isBulk: false,
      isDestructive: false,
      requiredFeatures: ['customers.people.view'],
    },
  ],
])

beforeEach(() => {
  jest.clearAllMocks()
  authMock.mockReturnValue({ sub: 'u1', tenantId: 't1', orgId: 'o1' })
  createRequestContainerMock.mockResolvedValue({ resolve: () => rbacService })
  rbacService.loadAcl.mockResolvedValue({ features: ['ai_assistant.tools.list'], isSuperAdmin: false })
  ensureAllModuleToolsLoadedMock.mockResolvedValue(undefined)
  toolRegistryMock.getTools.mockReturnValue(sampleTools)
  // Default: every tool is accessible to the caller.
  hasRequiredFeaturesMock.mockReturnValue(true)
})

describe('GET /api/ai_assistant/ai/tools', () => {
  it('returns 401 when the caller is unauthenticated', async () => {
    authMock.mockReturnValue(null)
    const res = await GET(buildRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('unauthenticated')
  })

  it('returns the accessible tool inventory filtered by requiredFeatures', async () => {
    const res = await GET(buildRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(3)
    expect(Array.isArray(body.tools)).toBe(true)
    // Sorted by name ascending.
    expect(body.tools[0].name).toBe('catalog.bulk_delete_products')
    expect(body.tools[1].name).toBe('catalog.update_product')
    expect(body.tools[2].name).toBe('customers.search')
    // Shape: mutation flag + display name + tags carried through.
    const mutation = body.tools.find((t: any) => t.name === 'catalog.update_product')
    expect(mutation.isMutation).toBe(true)
    expect(mutation.moduleId).toBe('catalog')
    expect(mutation.displayName).toBe('Update product')
    expect(mutation.tags).toContain('catalog')
    // Destructive metadata is serialized; predicates collapse to the sentinel string.
    expect(mutation.isDestructive).toBe(false)

    const bulkDelete = body.tools.find((t: any) => t.name === 'catalog.bulk_delete_products')
    expect(bulkDelete.isBulk).toBe(true)
    expect(bulkDelete.isDestructive).toBe('predicate')
  })

  it('omits tools the caller lacks features for', async () => {
    hasRequiredFeaturesMock.mockReturnValue(false)
    const res = await GET(buildRequest())
    const body = await res.json()
    expect(body.total).toBe(0)
    expect(body.tools).toEqual([])
  })
})
