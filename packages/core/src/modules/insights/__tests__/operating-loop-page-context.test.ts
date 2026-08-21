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
        personId: undefined,
        dealId: undefined,
        orderId: undefined,
        quoteId: undefined,
        productId: undefined,
        warehouseId: undefined,
        instanceId: undefined,
        taskId: undefined,
        integrationId: undefined,
        proposalId: undefined,
        messageId: undefined,
        teamMemberId: undefined,
        leaveRequestId: undefined,
      },
    })
  })

  it('covers all M5-M7 list table ids', () => {
    const cases: Array<[string, string]> = [
      ['customers.people.list', 'customers.person'],
      ['customers.companies.list', 'customers.company'],
      ['customers.deals.list', 'customers.deal'],
      ['sales.orders', 'sales.order'],
      ['sales.quotes', 'sales.quote'],
      ['inbox_ops.proposals.list', 'inbox_ops.proposal'],
      ['catalog.products', 'catalog.product'],
      ['catalog.products.list', 'catalog.product'],
      ['wms.inventory.balances', 'wms.inventory_balance'],
      ['wms.inventory.reservations', 'wms.inventory_reservation'],
      ['workflows.instances.list', 'workflows.instance'],
      ['workflows.tasks.list', 'workflows.task'],
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
      ['integrations.marketplace', 'integrations.integration'],
      ['messages', 'messages.message'],
      ['staff.team_members', 'staff.team_member'],
      ['staff.leave_requests', 'staff.leave_request'],
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
        personId: undefined,
        dealId: undefined,
        orderId: undefined,
        quoteId: undefined,
        productId: undefined,
        warehouseId: undefined,
        instanceId: undefined,
        taskId: undefined,
        integrationId: undefined,
        proposalId: undefined,
        messageId: undefined,
        teamMemberId: undefined,
        leaveRequestId: undefined,
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

  it('maps CRM and sales resourceKind plus resourceId on detail pages', () => {
    expect(
      buildOperatingLoopPageContext({
        resourceKind: 'customers.company',
        resourceId: 'company-1',
        organizationId: 'org-1',
      }),
    ).toMatchObject({
      view: 'operating_loop.detail',
      entityType: 'customers.company',
      recordId: 'company-1',
      extra: { customerEntityId: 'company-1' },
    })

    expect(
      buildOperatingLoopPageContext({
        resourceKind: 'customers.deal',
        resourceId: 'deal-1',
      }),
    ).toMatchObject({
      entityType: 'customers.deal',
      recordId: 'deal-1',
      extra: { dealId: 'deal-1' },
    })

    expect(
      buildOperatingLoopPageContext({
        resourceKind: 'sales.order',
        resourceId: 'order-1',
      }),
    ).toMatchObject({
      entityType: 'sales.order',
      recordId: 'order-1',
      extra: { orderId: 'order-1' },
    })
  })

  it('maps inbox, workflow, and integration detail ids', () => {
    expect(
      buildOperatingLoopPageContext({
        entityType: 'inbox_ops.proposal',
        recordId: 'proposal-1',
      }),
    ).toMatchObject({
      view: 'operating_loop.detail',
      extra: { proposalId: 'proposal-1' },
    })

    expect(
      buildOperatingLoopPageContext({
        entityType: 'workflows.instance',
        recordId: 'instance-1',
        organizationId: 'org-1',
      }),
    ).toMatchObject({
      extra: { instanceId: 'instance-1' },
      organizationId: 'org-1',
    })

    expect(
      buildOperatingLoopPageContext({
        entityType: 'workflows.task',
        recordId: 'task-1',
      }),
    ).toMatchObject({ extra: { taskId: 'task-1' } })

    expect(
      buildOperatingLoopPageContext({
        resourceKind: 'integrations.integration',
        resourceId: 'integration-1',
      }),
    ).toMatchObject({ extra: { integrationId: 'integration-1' } })

    expect(
      buildOperatingLoopPageContext({
        resourceKind: 'catalog.product',
        resourceId: 'product-1',
      }),
    ).toMatchObject({ extra: { productId: 'product-1' } })
  })

  it('maps staff and messages list table ids', () => {
    expect(buildOperatingLoopPageContext({ tableId: 'staff.leave_requests' })).toMatchObject({
      view: 'operating_loop.list',
      entityType: 'staff.leave_request',
      tableId: 'staff.leave_requests',
    })
    expect(buildOperatingLoopPageContext({ tableId: 'staff.team_members' })).toMatchObject({
      entityType: 'staff.team_member',
    })
    expect(buildOperatingLoopPageContext({ tableId: 'messages' })).toMatchObject({
      entityType: 'messages.message',
    })
  })

  it('maps staff leave and message detail contexts', () => {
    expect(
      buildOperatingLoopPageContext({
        entityType: 'staff.leave_request',
        recordId: 'leave-1',
        leaveRequestId: 'leave-1',
        organizationId: 'org-1',
      }),
    ).toMatchObject({
      view: 'operating_loop.detail',
      entityType: 'staff.leave_request',
      recordId: 'leave-1',
      extra: { leaveRequestId: 'leave-1' },
    })

    expect(
      buildOperatingLoopPageContext({
        entityType: 'messages.message',
        recordId: 'msg-1',
      }),
    ).toMatchObject({
      view: 'operating_loop.detail',
      entityType: 'messages.message',
      recordId: 'msg-1',
      extra: { messageId: 'msg-1' },
    })
  })
})
