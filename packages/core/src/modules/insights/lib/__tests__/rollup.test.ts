import { rollupAmountMetric, rollupChildren, rollupGrossMargin, resolveChildOrganizationIds } from '../rollup'

describe('resolveChildOrganizationIds', () => {
  it('prefers direct childIds over descendantIds', () => {
    expect(resolveChildOrganizationIds('parent', ['child-a', 'parent'], ['child-b'])).toEqual(['child-a'])
  })
})

describe('rollupAmountMetric', () => {
  it('sums child amount targets and actuals', () => {
    const result = rollupAmountMetric(
      'parent',
      'revenue',
      [
        {
          organizationId: 'child-a',
          metricKey: 'revenue',
          targetValue: '1000.00',
          actualValue: '800.00',
          unit: 'amount',
          currencyCode: 'CNY',
        },
        {
          organizationId: 'child-b',
          metricKey: 'revenue',
          targetValue: '500.00',
          actualValue: '250.00',
          unit: 'amount',
          currencyCode: 'CNY',
        },
      ],
      'CNY',
    )
    expect(result.targetValue).toBe('1500.00')
    expect(result.actualValue).toBe('1050.00')
    expect(result.completionRate).toBe('70.00')
    expect(result.isRollup).toBe(true)
  })
})

describe('rollupGrossMargin', () => {
  it('derives margin from summed profit and revenue, not average of rates', () => {
    const result = rollupGrossMargin('parent', [
      {
        organizationId: 'child-a',
        metricKey: 'gross_margin',
        targetValue: '50.00',
        actualValue: '50.00',
        unit: 'ratio',
        currencyCode: null,
        revenueActual: '1000.00',
        grossProfitActual: '500.00',
      },
      {
        organizationId: 'child-b',
        metricKey: 'gross_margin',
        targetValue: '20.00',
        actualValue: '20.00',
        unit: 'ratio',
        currencyCode: null,
        revenueActual: '1000.00',
        grossProfitActual: '200.00',
      },
    ])
    expect(result.actualValue).toBe('35.00')
    expect(result.unit).toBe('ratio')
  })
})

describe('rollupChildren', () => {
  it('delegates gross_profit to amount rollup', () => {
    const result = rollupChildren(
      'parent',
      'gross_profit',
      [
        {
          organizationId: 'child-a',
          metricKey: 'gross_profit',
          targetValue: '300.00',
          actualValue: '200.00',
          unit: 'amount',
          currencyCode: 'CNY',
        },
      ],
      'CNY',
    )
    expect(result.actualValue).toBe('200.00')
  })
})
