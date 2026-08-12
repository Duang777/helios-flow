import { CommercialInvoice, PaymentAllocation } from '../../../commercial/data/entities'
import { GovernanceFinding } from '../../../governance/data/entities'
import { Project, ProjectMilestone } from '../../../projects/data/entities'
import { KpiTarget } from '../../data/entities'
import { collectOperatingLoopTodayDigest } from '../operatingLoopToday'

type MockFindCall = {
  entity: unknown
  filter: Record<string, unknown>
}

function createEntity<T extends object>(values: T): T {
  return values
}

function createMockEntityManager(overrides?: {
  find?: (entity: unknown, filter: Record<string, unknown>) => unknown[] | Promise<unknown[]>
}) {
  const calls: MockFindCall[] = []
  const em = {
    calls,
    count: jest.fn(async (entity: unknown, filter: Record<string, unknown>) => {
      calls.push({ entity, filter })
      if (entity === GovernanceFinding) return 1
      return 0
    }),
    find: jest.fn(async (entity: unknown, filter: Record<string, unknown>) => {
      calls.push({ entity, filter })
      if (overrides?.find) {
        return overrides.find(entity, filter)
      }
      if (entity === CommercialInvoice) {
        return [
          createEntity({
            id: 'invoice-1',
            organizationId: 'org-1',
            tenantId: 'tenant-1',
            invoiceNo: 'INV-001',
            status: 'issued',
            amount: '1000.00',
            currencyCode: 'CNY',
            issuedOn: '2026-08-01',
            dueDate: '2026-08-05',
            projectId: 'project-1',
            contractId: 'contract-1',
            customerEntityId: 'customer-1',
            deletedAt: null,
          }),
        ]
      }
      if (entity === PaymentAllocation) {
        return [
          createEntity({
            id: 'allocation-1',
            invoiceId: 'invoice-1',
            allocatedAmount: '300.00',
            allocatedOn: '2026-08-06',
            organizationId: 'org-1',
            tenantId: 'tenant-1',
            deletedAt: null,
          }),
        ]
      }
      if (entity === GovernanceFinding) {
        return [
          createEntity({
            id: 'finding-1',
            organizationId: 'org-1',
            tenantId: 'tenant-1',
            ruleId: 'gov.invoice_overdue_outstanding',
            severity: 'critical',
            status: 'open',
            title: '逾期应收需要处置',
            reason: '发票已逾期且存在未核销余额。',
            evidenceIds: [{ type: 'commercial.invoice', id: 'invoice-1', module: 'commercial' }],
            subjectType: 'commercial.invoice',
            subjectId: 'invoice-1',
            detectedAt: new Date('2026-08-12T00:00:00Z'),
            asOf: '2026-08-12',
            deletedAt: null,
          }),
        ]
      }
      if (entity === ProjectMilestone) {
        return [
          createEntity({
            id: 'milestone-1',
            organizationId: 'org-1',
            tenantId: 'tenant-1',
            projectId: 'project-1',
            name: '上线验收',
            status: 'planned',
            plannedDate: '2026-08-01',
            actualDate: null,
            sortOrder: 1,
            isActive: true,
            deletedAt: null,
          }),
        ]
      }
      if (entity === Project) {
        return [
          createEntity({
            id: 'project-1',
            organizationId: 'org-1',
            tenantId: 'tenant-1',
            name: '华东履约项目',
            customerEntityId: 'customer-1',
            deletedAt: null,
          }),
        ]
      }
      if (entity === KpiTarget) {
        return [
          createEntity({
            id: 'kpi-target-1',
            organizationId: 'org-1',
            tenantId: 'tenant-1',
            metricKey: 'collection',
            unit: 'ratio',
            periodType: 'month',
            periodKey: '2026-08',
            targetValue: '90.00',
            currencyCode: null,
            isActive: true,
            deletedAt: null,
          }),
        ]
      }
      return []
    }),
  }
  return em
}

describe('collectOperatingLoopTodayDigest', () => {
  const scope = {
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    asOf: '2026-08-12',
  }

  it('collects real grouped records with hrefs, formulas, and scoped ids', async () => {
    const em = createMockEntityManager()
    const digest = await collectOperatingLoopTodayDigest(em as never, scope)

    expect(digest.metrics).toMatchObject({
      criticalFindingCount: 1,
      delayedProjectCount: 1,
      overdueInvoiceCount: 1,
      overdueOutstanding: '700.00',
      kpiGapCount: 1,
      periodType: 'month',
      periodKey: '2026-08',
    })
    expect(digest.groups.criticalFindings[0]).toMatchObject({
      recordId: 'finding-1',
      href: '/backend/governance/findings/finding-1',
      formulaSource: 'governance.findings rule=gov.invoice_overdue_outstanding',
      scopedIds: { findingId: 'finding-1', invoiceId: 'invoice-1' },
    })
    expect(digest.groups.overdueInvoices[0]).toMatchObject({
      title: 'INV-001',
      amount: '700.00',
      href: '/backend/commercial/invoices/invoice-1',
      scopedIds: {
        invoiceId: 'invoice-1',
        projectId: 'project-1',
        contractId: 'contract-1',
        customerEntityId: 'customer-1',
      },
    })
    expect(digest.groups.delayedProjects[0]).toMatchObject({
      title: '华东履约项目',
      href: '/backend/projects/project-1',
      scopedIds: { projectId: 'project-1', milestoneId: 'milestone-1' },
    })
    expect(digest.groups.kpiGaps[0]).toMatchObject({
      title: 'collection',
      href: '/backend/insights/kpi-targets/kpi-target-1',
      scopedIds: { kpiTargetId: 'kpi-target-1' },
    })
  })

  it('includes active annual KPI targets in the today digest', async () => {
    const em = createMockEntityManager({
      find: (entity) => {
        if (entity === KpiTarget) {
          return [
            createEntity({
              id: 'kpi-target-year-1',
              organizationId: 'org-1',
              tenantId: 'tenant-1',
              metricKey: 'revenue',
              unit: 'amount',
              periodType: 'year',
              periodKey: '2026',
              targetValue: '5000.00',
              currencyCode: 'CNY',
              isActive: true,
              deletedAt: null,
            }),
          ]
        }
        if (entity === ProjectMilestone || entity === Project || entity === GovernanceFinding) return []
        if (entity === CommercialInvoice || entity === PaymentAllocation) return []
        return []
      },
    })

    const digest = await collectOperatingLoopTodayDigest(em as never, scope)

    expect(digest.groups.kpiGaps[0]).toMatchObject({
      title: 'revenue',
      href: '/backend/insights/kpi-targets/kpi-target-year-1',
      scopedIds: { kpiTargetId: 'kpi-target-year-1' },
      facts: {
        targetValue: '5000.00',
        actualValue: '0.00',
        periodType: 'year',
        periodKey: '2026',
      },
    })
    expect(digest.metrics.kpiGapCount).toBe(1)
  })

  it('keeps partial group failures visible without replacing them with fake data', async () => {
    const em = createMockEntityManager({
      find: (entity) => {
        if (entity === GovernanceFinding) throw new Error('governance source down')
        return []
      },
    })

    const digest = await collectOperatingLoopTodayDigest(em as never, scope)

    expect(digest.sourceStatus.criticalFindings).toEqual({
      ok: false,
      message: 'governance source down',
    })
    expect(digest.groups.criticalFindings).toEqual([])
    expect(digest.sourceStatus.overdueInvoices).toEqual({ ok: true })
  })
})
