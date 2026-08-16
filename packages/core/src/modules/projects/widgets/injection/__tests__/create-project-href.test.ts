import {
  buildCreateProjectHrefFromCompany,
  buildCreateProjectHrefFromDeal,
} from '../create-project-href'

describe('buildCreateProjectHrefFromDeal', () => {
  it('prefers company entity id then deal title', () => {
    const href = buildCreateProjectHrefFromDeal(undefined, {
      deal: { id: '11111111-1111-1111-1111-111111111111', title: 'Won deal' },
      companies: [{ id: '22222222-2222-2222-2222-222222222222', label: 'Acme' }],
      people: [{ id: '33333333-3333-3333-3333-333333333333', label: 'Ada' }],
    })
    expect(href).toContain('/backend/projects/create?')
    expect(href).toContain('dealId=11111111-1111-1111-1111-111111111111')
    expect(href).toContain('customerEntityId=22222222-2222-2222-2222-222222222222')
    expect(href).toContain('name=Won+deal')
  })

  it('falls back to person entity when no company', () => {
    const href = buildCreateProjectHrefFromDeal(
      { dealId: '11111111-1111-1111-1111-111111111111' },
      {
        people: [{ id: '33333333-3333-3333-3333-333333333333' }],
      },
    )
    expect(href).toContain('customerEntityId=33333333-3333-3333-3333-333333333333')
  })

  it('returns null without deal id', () => {
    expect(buildCreateProjectHrefFromDeal({}, { companies: [{ id: 'x' }] })).toBeNull()
  })
})

describe('buildCreateProjectHrefFromCompany', () => {
  it('builds href from company id and name', () => {
    const href = buildCreateProjectHrefFromCompany(undefined, {
      company: { id: '22222222-2222-2222-2222-222222222222', displayName: 'Acme Co' },
    })
    expect(href).toContain('customerEntityId=22222222-2222-2222-2222-222222222222')
    expect(href).toContain('name=Acme+Co')
  })
})
