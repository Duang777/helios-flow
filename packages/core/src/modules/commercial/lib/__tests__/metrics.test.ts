import { computeCommercialMetrics } from '../metrics'

describe('computeCommercialMetrics', () => {
  const asOf = '2026-08-31'

  it('computes PRD §7.9 revenue, cost, profit and margin', () => {
    const result = computeCommercialMetrics({
      asOf,
      revenues: [
        { amount: '1000.00', dataVersion: 'actual' },
        { amount: '500.00', dataVersion: 'forecast' },
      ],
      costs: [{ amount: '400.00', dataVersion: 'actual' }],
      contracts: [{ amount: '2000.00' }],
      invoices: [
        { id: 'inv-1', amount: '800.00', dueDate: '2026-08-01', status: 'issued' },
        { id: 'inv-2', amount: '200.00', dueDate: '2026-09-15', status: 'issued' },
      ],
      allocations: [{ invoiceId: 'inv-1', allocatedAmount: '300.00' }],
    })

    expect(result.actualRevenue).toBe('1000.00')
    expect(result.actualCost).toBe('400.00')
    expect(result.projectGrossProfit).toBe('600.00')
    expect(result.projectGrossMargin).toBe('60.00')
    expect(result.invoiceRate).toBe('50.00')
    expect(result.allocatedPayment).toBe('300.00')
    expect(result.collectionRate).toBe('30.00')
    expect(result.arOutstanding).toBe('700.00')
    expect(result.overdueOutstanding).toBe('500.00')
    expect(result.definitions.actualRevenue.formula).toContain('actual')
  })

  it('returns null margin and rates when denominators are zero', () => {
    const result = computeCommercialMetrics({
      asOf,
      revenues: [],
      costs: [],
      contracts: [],
      invoices: [],
      allocations: [],
    })

    expect(result.projectGrossMargin).toBeNull()
    expect(result.invoiceRate).toBeNull()
    expect(result.collectionRate).toBeNull()
    expect(result.actualRevenue).toBe('0.00')
    expect(result.arOutstanding).toBe('0.00')
  })

  it('excludes void invoices from invoice and collection totals', () => {
    const result = computeCommercialMetrics({
      asOf,
      revenues: [],
      costs: [],
      contracts: [{ amount: '100.00', status: 'active' }],
      invoices: [
        { id: 'inv-1', amount: '100.00', dueDate: null, status: 'issued' },
        { id: 'inv-2', amount: '999.00', dueDate: null, status: 'void' },
      ],
      allocations: [{ invoiceId: 'inv-1', allocatedAmount: '40.00' }],
    })

    expect(result.invoiceRate).toBe('100.00')
    expect(result.collectionRate).toBe('40.00')
    expect(result.arOutstanding).toBe('60.00')
  })

  it('excludes draft invoices and draft/cancelled contracts from operating rates', () => {
    const result = computeCommercialMetrics({
      asOf,
      revenues: [],
      costs: [],
      contracts: [
        { amount: '1000.00', status: 'active' },
        { amount: '9000.00', status: 'draft' },
        { amount: '5000.00', status: 'cancelled' },
      ],
      invoices: [
        { id: 'inv-1', amount: '400.00', dueDate: '2026-08-01', status: 'issued' },
        { id: 'inv-2', amount: '800.00', dueDate: '2026-07-01', status: 'draft' },
      ],
      allocations: [],
    })

    expect(result.invoiceRate).toBe('40.00')
    expect(result.arOutstanding).toBe('400.00')
    expect(result.overdueOutstanding).toBe('400.00')
  })
})
