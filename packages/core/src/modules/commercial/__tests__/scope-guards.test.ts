import { assertTenantScope } from '../ai-tools/types'

function baseCtx(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 't1',
    organizationId: 'o1',
    userId: 'u1',
    container: { resolve: jest.fn() },
    userFeatures: ['commercial.manage'],
    isSuperAdmin: false,
    ...overrides,
  }
}

describe('commercial.assertTenantScope', () => {
  it('throws when tenant context is missing (privilege boundary)', () => {
    expect(() => assertTenantScope(baseCtx({ tenantId: null }) as never)).toThrow(
      /Tenant context is required/,
    )
  })

  it('allows a present tenant with a null organization (org is checked per-operation)', () => {
    expect(assertTenantScope(baseCtx({ organizationId: null }) as never)).toEqual({
      tenantId: 't1',
      organizationId: null,
    })
  })

  it('returns tenant and organization when both are present', () => {
    expect(assertTenantScope(baseCtx() as never)).toEqual({
      tenantId: 't1',
      organizationId: 'o1',
    })
  })
})
