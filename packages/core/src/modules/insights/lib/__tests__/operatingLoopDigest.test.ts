import {
  buildOperatingLoopDigestNotification,
  isKpiTargetActiveOn,
  resolveOperatingLoopDigestPeriod,
  type OperatingLoopDigestMetrics,
} from '../operatingLoopDigest'

describe('operating loop digest', () => {
  const baseMetrics: OperatingLoopDigestMetrics = {
    criticalFindingCount: 0,
    delayedProjectCount: 0,
    overdueInvoiceCount: 0,
    overdueOutstanding: '0.00',
    kpiGapCount: 0,
    periodType: 'month',
    periodKey: '2026-08',
  }

  it('does not create a notification when there is no operating signal', () => {
    expect(
      buildOperatingLoopDigestNotification({
        organizationId: 'org-1',
        asOf: '2026-08-31',
        metrics: baseMetrics,
      }),
    ).toBeNull()
  })

  it('builds a stable notification payload with numbers and formula-source link', () => {
    const digest = buildOperatingLoopDigestNotification({
      organizationId: 'org-1',
      asOf: '2026-08-31',
      metrics: {
        ...baseMetrics,
        criticalFindingCount: 2,
        delayedProjectCount: 1,
        overdueInvoiceCount: 3,
        overdueOutstanding: '1200.00',
        kpiGapCount: 4,
      },
    })

    expect(digest).toMatchObject({
      groupKey: 'insights.operating_loop:org-1:2026-08-31',
      linkHref: '/backend/insights/operating-loop/today',
      sourceEntityType: 'insights.operating_loop',
      sourceEntityId: 'org-1',
      bodyVariables: {
        asOf: '2026-08-31',
        criticalFindingCount: '2',
        delayedProjectCount: '1',
        overdueInvoiceCount: '3',
        overdueOutstanding: '1200.00',
        kpiGapCount: '4',
        periodKey: '2026-08',
        formulaSources: 'governance.findings, projects.milestones, commercial.metrics, insights.kpi.completion',
      },
    })
  })

  it('uses the current month as the operating KPI digest period', () => {
    expect(resolveOperatingLoopDigestPeriod('2026-08-31')).toEqual({
      periodType: 'month',
      periodKey: '2026-08',
    })
  })

  it('treats month, quarter, and year KPI targets as active when they cover today', () => {
    expect(isKpiTargetActiveOn({ periodType: 'month', periodKey: '2026-08' } as never, '2026-08-12')).toBe(true)
    expect(isKpiTargetActiveOn({ periodType: 'quarter', periodKey: '2026-Q3' } as never, '2026-08-12')).toBe(true)
    expect(isKpiTargetActiveOn({ periodType: 'year', periodKey: '2026' } as never, '2026-08-12')).toBe(true)
    expect(isKpiTargetActiveOn({ periodType: 'month', periodKey: '2026-09' } as never, '2026-08-12')).toBe(false)
  })
})
