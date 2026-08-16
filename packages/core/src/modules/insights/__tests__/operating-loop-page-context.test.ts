import { buildOperatingLoopPageContext } from '../widgets/injection/operating-loop-trigger/page-context'

describe('buildOperatingLoopPageContext', () => {
  it('maps M5-M7 list pages to operating loop list context', () => {
    expect(
      buildOperatingLoopPageContext({
        tableId: 'commercial.invoices.list',
        organizationId: 'org-1',
        projectId: 'project-1',
        contractId: 'contract-1',
        customerEntityId: 'customer-1',
        searchValue: 'overdue',
        visibleFilters: { status: 'issued' },
        page: 2,
        pageSize: 50,
        totalMatching: 7,
        selectedRowIds: ['invoice-1', 'invoice-2'],
      }),
    ).toEqual({
      view: 'operating_loop.list',
      entityType: 'commercial.invoice',
      recordType: 'invoice',
      recordId: null,
      organizationId: 'org-1',
      tableId: 'commercial.invoices.list',
      visibleFilters: { status: 'issued' },
      searchValue: 'overdue',
      page: 2,
      pageSize: 50,
      totalMatching: 7,
      selectedRecordIds: ['invoice-1', 'invoice-2'],
      extra: {
        projectId: 'project-1',
        milestoneId: undefined,
        riskId: undefined,
        contractId: 'contract-1',
        invoiceId: undefined,
        paymentId: undefined,
        allocationId: undefined,
        kpiTargetId: undefined,
        findingId: undefined,
        identityMapId: undefined,
        customerEntityId: 'customer-1',
      },
    })
  })

  it('covers all M5-M7 list table ids', () => {
    const cases: Array<[string, string]> = [
      ['projects.list', 'projects.project'],
      ['projects.milestones.list', 'projects.milestone'],
      ['projects.risks.list', 'projects.risk'],
      ['commercial.contracts.list', 'commercial.contract'],
      ['commercial.invoices.list', 'commercial.invoice'],
      ['commercial.payments.list', 'commercial.payment'],
      ['commercial.allocations.list', 'commercial.payment_allocation'],
      ['insights.kpi_targets.list', 'insights.kpi_target'],
      ['insights.kpi.completion', 'insights.kpi_completion'],
      ['governance.findings.list', 'governance.finding'],
      ['governance.identity_maps.list', 'governance.identity_map'],
    ]

    for (const [tableId, entityType] of cases) {
      expect(buildOperatingLoopPageContext({ tableId })).toMatchObject({
        view: 'operating_loop.list',
        entityType,
      })
    }
  })

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
        milestoneId: undefined,
        riskId: undefined,
        contractId: undefined,
        invoiceId: undefined,
        paymentId: undefined,
        allocationId: undefined,
        kpiTargetId: undefined,
        findingId: undefined,
        identityMapId: undefined,
        customerEntityId: undefined,
      },
    })
  })

  it('derives linked commercial ids from host data and maps allocations', () => {
    expect(
      buildOperatingLoopPageContext(
        {
          entityType: 'commercial.payment_allocation',
          recordId: 'allocation-1',
          data: {
            allocation: {
              id: 'allocation-1',
              organizationId: 'org-1',
              projectId: 'project-1',
              contractId: 'contract-1',
              invoiceId: 'invoice-1',
              paymentId: 'payment-1',
              customerEntityId: 'customer-1',
            },
          },
        },
        undefined,
      ),
    ).toMatchObject({
      entityType: 'commercial.payment_allocation',
      recordType: 'payment_allocation',
      recordId: 'allocation-1',
      organizationId: 'org-1',
      extra: {
        projectId: 'project-1',
        contractId: 'contract-1',
        invoiceId: 'invoice-1',
        paymentId: 'payment-1',
        allocationId: 'allocation-1',
        customerEntityId: 'customer-1',
      },
    })
  })

  it('returns null when the host omits a supported entity type or record id', () => {
    expect(buildOperatingLoopPageContext({ entityType: 'unknown', recordId: 'x' })).toBeNull()
    expect(buildOperatingLoopPageContext({ entityType: 'projects.project' })).toBeNull()
    expect(buildOperatingLoopPageContext({ tableId: 'unknown.table' })).toBeNull()
  })
})
