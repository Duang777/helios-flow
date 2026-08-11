import { buildOperatingLoopPageContext } from '../widgets/injection/operating-loop-trigger/page-context'

describe('buildOperatingLoopPageContext', () => {
  it('binds project detail context with organization scope', () => {
    expect(
      buildOperatingLoopPageContext({
        entityType: 'projects.project',
        recordId: 'project-1',
        projectId: 'project-1',
        organizationId: 'org-1',
      }),
    ).toEqual({
      view: 'operating_loop.detail',
      entityType: 'projects.project',
      recordType: 'project',
      recordId: 'project-1',
      organizationId: 'org-1',
      extra: {
        projectId: 'project-1',
        contractId: undefined,
        invoiceId: undefined,
        paymentId: undefined,
        kpiTargetId: undefined,
        findingId: undefined,
        customerEntityId: undefined,
      },
    })
  })

  it('derives linked commercial ids from host data', () => {
    expect(
      buildOperatingLoopPageContext(
        {
          entityType: 'commercial.invoice',
          recordId: 'invoice-1',
          data: {
            invoice: {
              id: 'invoice-1',
              organizationId: 'org-1',
              projectId: 'project-1',
              contractId: 'contract-1',
              customerEntityId: 'customer-1',
            },
          },
        },
        undefined,
      ),
    ).toMatchObject({
      entityType: 'commercial.invoice',
      recordType: 'invoice',
      recordId: 'invoice-1',
      organizationId: 'org-1',
      extra: {
        projectId: 'project-1',
        contractId: 'contract-1',
        customerEntityId: 'customer-1',
      },
    })
  })

  it('returns null when the host omits a supported entity type or record id', () => {
    expect(buildOperatingLoopPageContext({ entityType: 'unknown', recordId: 'x' })).toBeNull()
    expect(buildOperatingLoopPageContext({ entityType: 'projects.project' })).toBeNull()
  })
})
