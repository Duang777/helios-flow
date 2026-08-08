export function toMoneyCents(amount: string): bigint {
  const normalized = amount.trim()
  const [wholePart, fractionPart = ''] = normalized.split('.')
  const whole = wholePart.length > 0 ? wholePart : '0'
  const fraction = (fractionPart + '00').slice(0, 2)
  return BigInt(whole) * 100n + BigInt(fraction)
}

export function fromMoneyCents(cents: bigint): string {
  const negative = cents < 0n
  const absolute = negative ? -cents : cents
  const whole = absolute / 100n
  const fraction = absolute % 100n
  return `${negative ? '-' : ''}${whole}.${fraction.toString().padStart(2, '0')}`
}

export function sumMoneyCents(amounts: string[]): bigint {
  return amounts.reduce((total, amount) => total + toMoneyCents(amount), 0n)
}

export function ratioOrNull(numerator: bigint, denominator: bigint): string | null {
  if (denominator === 0n) return null
  const scaled = (numerator * 10000n) / denominator
  const whole = scaled / 100n
  const fraction = scaled % 100n
  return `${whole}.${fraction.toString().padStart(2, '0')}`
}

export type CommercialRevenueFact = {
  amount: string
  dataVersion: string
}

export type CommercialCostFact = {
  amount: string
  dataVersion: string
}

export type CommercialContractFact = {
  amount: string
  status?: string
}

export type CommercialInvoiceFact = {
  id: string
  amount: string
  dueDate: string | null
  status: string
}

export type CommercialAllocationFact = {
  invoiceId: string
  allocatedAmount: string
}

export type CommercialMetricsInput = {
  revenues: CommercialRevenueFact[]
  costs: CommercialCostFact[]
  contracts: CommercialContractFact[]
  invoices: CommercialInvoiceFact[]
  allocations: CommercialAllocationFact[]
  asOf: string
  currencyCode?: string
  filters?: Record<string, string | undefined>
}

export type MetricDefinition = {
  formula: string
  sources: string[]
}

export type CommercialMetricsResult = {
  actualRevenue: string
  actualCost: string
  projectGrossProfit: string
  projectGrossMargin: string | null
  invoiceRate: string | null
  allocatedPayment: string
  collectionRate: string | null
  arOutstanding: string
  overdueOutstanding: string
  asOf: string
  currencyCode: string
  filters: Record<string, string | undefined>
  definitions: Record<string, MetricDefinition>
}

const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  actualRevenue: {
    formula: 'Σ recognized_revenue where data_version = actual',
    sources: ['project_revenues'],
  },
  actualCost: {
    formula: 'Σ cost_amount where data_version = actual',
    sources: ['project_costs'],
  },
  projectGrossProfit: {
    formula: 'actualRevenue − actualCost',
    sources: ['project_revenues', 'project_costs'],
  },
  projectGrossMargin: {
    formula: 'projectGrossProfit ÷ actualRevenue (null when revenue = 0)',
    sources: ['project_revenues', 'project_costs'],
  },
  invoiceRate: {
    formula: 'Σ issued invoice_amount ÷ Σ active/completed contract_amount',
    sources: ['commercial_invoices', 'commercial_contracts'],
  },
  allocatedPayment: {
    formula: 'Σ allocated_amount',
    sources: ['payment_allocations'],
  },
  collectionRate: {
    formula: 'Σ allocated_amount ÷ Σ issued invoice_amount',
    sources: ['payment_allocations', 'commercial_invoices'],
  },
  arOutstanding: {
    formula: 'Σ issued invoice_amount − Σ allocated_amount per invoice',
    sources: ['commercial_invoices', 'payment_allocations'],
  },
  overdueOutstanding: {
    formula: 'Σ (issued invoice − allocated) where due_date < asOf and remainder > 0',
    sources: ['commercial_invoices', 'payment_allocations'],
  },
}

/** Operating contracts that count toward invoice-rate denominators. */
export function isOperatingContractStatus(status: string | undefined): boolean {
  if (!status) return true
  return status === 'active' || status === 'completed'
}

/** Issued invoices only — draft/void are excluded from operating AR and rates. */
export function isOperatingInvoiceStatus(status: string): boolean {
  return status === 'issued'
}

export function computeCommercialMetrics(input: CommercialMetricsInput): CommercialMetricsResult {
  const currencyCode = input.currencyCode ?? 'CNY'
  const filters = input.filters ?? {}

  const actualRevenueRows = input.revenues.filter((row) => row.dataVersion === 'actual')
  const actualCostRows = input.costs.filter((row) => row.dataVersion === 'actual')
  const operatingContracts = input.contracts.filter((row) => isOperatingContractStatus(row.status))
  const activeInvoices = input.invoices.filter((row) => isOperatingInvoiceStatus(row.status))

  const actualRevenueCents = sumMoneyCents(actualRevenueRows.map((row) => row.amount))
  const actualCostCents = sumMoneyCents(actualCostRows.map((row) => row.amount))
  const contractTotalCents = sumMoneyCents(operatingContracts.map((row) => row.amount))
  const invoiceTotalCents = sumMoneyCents(activeInvoices.map((row) => row.amount))
  const allocatedTotalCents = sumMoneyCents(input.allocations.map((row) => row.allocatedAmount))

  const allocByInvoice = new Map<string, bigint>()
  for (const allocation of input.allocations) {
    const previous = allocByInvoice.get(allocation.invoiceId) ?? 0n
    allocByInvoice.set(allocation.invoiceId, previous + toMoneyCents(allocation.allocatedAmount))
  }

  let arOutstandingCents = 0n
  let overdueOutstandingCents = 0n
  for (const invoice of activeInvoices) {
    const invoiceCents = toMoneyCents(invoice.amount)
    const allocatedCents = allocByInvoice.get(invoice.id) ?? 0n
    const remainder = invoiceCents - allocatedCents
    if (remainder > 0n) {
      arOutstandingCents += remainder
      if (invoice.dueDate && invoice.dueDate < input.asOf) {
        overdueOutstandingCents += remainder
      }
    }
  }

  const grossProfitCents = actualRevenueCents - actualCostCents

  return {
    actualRevenue: fromMoneyCents(actualRevenueCents),
    actualCost: fromMoneyCents(actualCostCents),
    projectGrossProfit: fromMoneyCents(grossProfitCents),
    projectGrossMargin: ratioOrNull(grossProfitCents, actualRevenueCents),
    invoiceRate: ratioOrNull(invoiceTotalCents, contractTotalCents),
    allocatedPayment: fromMoneyCents(allocatedTotalCents),
    collectionRate: ratioOrNull(allocatedTotalCents, invoiceTotalCents),
    arOutstanding: fromMoneyCents(arOutstandingCents),
    overdueOutstanding: fromMoneyCents(overdueOutstandingCents),
    asOf: input.asOf,
    currencyCode,
    filters,
    definitions: METRIC_DEFINITIONS,
  }
}
