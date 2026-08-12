import {
  buildCompletionItem,
  computeCompletionRate,
  computeMetricActuals,
  filterFactsByPeriod,
  parsePeriodRange,
  type DatedCommercialFacts,
} from '../completion'

describe('parsePeriodRange', () => {
  it('parses year, quarter, and month keys', () => {
    expect(parsePeriodRange('year', '2026')).toEqual({ start: '2026-01-01', end: '2026-12-31' })
    expect(parsePeriodRange('quarter', '2026-Q3')).toEqual({ start: '2026-07-01', end: '2026-09-30' })
    expect(parsePeriodRange('month', '2026-08')).toEqual({ start: '2026-08-01', end: '2026-08-31' })
  })
})

describe('computeMetricActuals', () => {
  const facts: DatedCommercialFacts = {
    revenues: [
      { amount: '1000.00', dataVersion: 'actual', recognizedOn: '2026-08-10' },
      { amount: '500.00', dataVersion: 'actual', recognizedOn: '2026-07-01' },
    ],
    costs: [{ amount: '400.00', dataVersion: 'actual', incurredOn: '2026-08-05' }],
    contracts: [
      { amount: '2000.00', status: 'active', startDate: '2026-08-01' },
      { amount: '9999.00', status: 'draft', startDate: '2026-08-01' },
      { amount: '5000.00', status: 'active', startDate: '2026-07-01' },
    ],
    invoices: [
      { id: 'inv-1', amount: '800.00', dueDate: '2026-08-20', status: 'issued', issuedOn: '2026-08-01' },
    ],
    allocations: [
      { invoiceId: 'inv-1', allocatedAmount: '300.00', allocatedOn: '2026-08-15' },
    ],
  }

  it('filters facts by month and computes revenue completion actuals', () => {
    const actuals = computeMetricActuals(facts, 'month', '2026-08', 'revenue', '2026-08-31')
    expect(actuals.actualValue).toBe('1000.00')
    expect(actuals.unit).toBe('amount')
    expect(actuals.actualSource).toBe('commercial.metrics')
  })

  it('does not count facts after asOf inside the active period', () => {
    const actuals = computeMetricActuals(
      {
        ...facts,
        revenues: [
          ...facts.revenues,
          { amount: '9000.00', dataVersion: 'actual', recognizedOn: '2026-08-20' },
        ],
        costs: [
          ...facts.costs,
          { amount: '1000.00', dataVersion: 'actual', incurredOn: '2026-08-20' },
        ],
        invoices: [
          ...facts.invoices,
          { id: 'inv-2', amount: '9000.00', dueDate: '2026-08-30', status: 'issued', issuedOn: '2026-08-20' },
        ],
        allocations: [
          ...facts.allocations,
          { invoiceId: 'inv-2', allocatedAmount: '9000.00', allocatedOn: '2026-08-20' },
        ],
      },
      'month',
      '2026-08',
      'revenue',
      '2026-08-12',
    )

    expect(actuals.actualValue).toBe('1000.00')
  })

  it('computes gross margin as ratio within period', () => {
    const actuals = computeMetricActuals(facts, 'month', '2026-08', 'gross_margin', '2026-08-31')
    expect(actuals.actualValue).toBe('60.00')
    expect(actuals.unit).toBe('ratio')
  })

  it('computes completion rate against target', () => {
    const actuals = computeMetricActuals(facts, 'month', '2026-08', 'revenue', '2026-08-31')
    const item = buildCompletionItem({
      organizationId: 'org-1',
      metricKey: 'revenue',
      targetValue: '2000.00',
      actualValue: actuals.actualValue,
      unit: actuals.unit,
      currencyCode: 'CNY',
      actualSource: actuals.actualSource,
    })
    expect(item.completionRate).toBe('50.00')
  })

  it('excludes out-of-period revenue from filtered metrics input', () => {
    const filtered = filterFactsByPeriod(facts, 'month', '2026-08')
    expect(filtered.revenues).toHaveLength(1)
    expect(filtered.revenues[0]?.amount).toBe('1000.00')
    expect(filtered.contracts.map((row) => row.amount).sort()).toEqual(['2000.00', '9999.00'])
  })
})

describe('computeCompletionRate', () => {
  it('returns null when target is zero', () => {
    expect(computeCompletionRate('100.00', '0')).toBeNull()
  })
})
