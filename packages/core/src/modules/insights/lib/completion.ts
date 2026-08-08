import {
  computeCommercialMetrics,
  fromMoneyCents,
  sumMoneyCents,
  toMoneyCents,
  type CommercialMetricsInput,
  type CommercialMetricsResult,
  ratioOrNull,
} from '../../commercial/lib/metrics'
import type { metricKeySchema, periodTypeSchema } from '../data/validators'
import type { z } from 'zod'

export type MetricKey = z.infer<typeof metricKeySchema>
export type PeriodType = z.infer<typeof periodTypeSchema>

export type DatedCommercialFacts = {
  revenues: Array<{ amount: string; dataVersion: string; recognizedOn: string }>
  costs: Array<{ amount: string; dataVersion: string; incurredOn: string }>
  contracts: Array<{ amount: string }>
  invoices: Array<{ id: string; amount: string; dueDate: string | null; status: string; issuedOn: string }>
  allocations: Array<{ invoiceId: string; allocatedAmount: string; allocatedOn: string | null }>
}

export type CompletionItem = {
  organizationId: string
  metricKey: MetricKey
  targetValue: string | null
  actualValue: string | null
  completionRate: string | null
  unit: 'amount' | 'ratio'
  currencyCode: string | null
  actualSource: 'commercial.metrics' | 'projects'
}

export function parsePeriodRange(
  periodType: PeriodType,
  periodKey: string,
): { start: string; end: string } {
  if (periodType === 'year') {
    return { start: `${periodKey}-01-01`, end: `${periodKey}-12-31` }
  }
  if (periodType === 'quarter') {
    const match = /^(\d{4})-Q([1-4])$/.exec(periodKey)
    if (!match) throw new Error('[internal] Invalid quarter periodKey')
    const year = match[1]
    const quarter = Number(match[2])
    const startMonth = (quarter - 1) * 3 + 1
    const endMonth = startMonth + 2
    const endDay = endMonth === 3 || endMonth === 12 ? 31 : endMonth === 6 || endMonth === 9 ? 30 : 31
    return {
      start: `${year}-${String(startMonth).padStart(2, '0')}-01`,
      end: `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
    }
  }
  const [year, month] = periodKey.split('-')
  const lastDay = new Date(Number(year), Number(month), 0).getDate()
  return {
    start: `${periodKey}-01`,
    end: `${periodKey}-${String(lastDay).padStart(2, '0')}`,
  }
}

function dateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

export function filterFactsByPeriod(
  facts: DatedCommercialFacts,
  periodType: PeriodType,
  periodKey: string,
): CommercialMetricsInput {
  const { start, end } = parsePeriodRange(periodType, periodKey)
  return {
    revenues: facts.revenues
      .filter((row) => dateInRange(row.recognizedOn, start, end))
      .map((row) => ({ amount: row.amount, dataVersion: row.dataVersion })),
    costs: facts.costs
      .filter((row) => dateInRange(row.incurredOn, start, end))
      .map((row) => ({ amount: row.amount, dataVersion: row.dataVersion })),
    contracts: facts.contracts,
    invoices: facts.invoices
      .filter((row) => dateInRange(row.issuedOn, start, end))
      .map((row) => ({
        id: row.id,
        amount: row.amount,
        dueDate: row.dueDate,
        status: row.status,
      })),
    allocations: facts.allocations
      .filter((row) => row.allocatedOn && dateInRange(row.allocatedOn, start, end))
      .map((row) => ({
        invoiceId: row.invoiceId,
        allocatedAmount: row.allocatedAmount,
      })),
    asOf: end,
  }
}

export function resolveActualForMetric(
  metrics: CommercialMetricsResult,
  metricKey: MetricKey,
): { actualValue: string | null; unit: 'amount' | 'ratio' } {
  switch (metricKey) {
    case 'revenue':
      return { actualValue: metrics.actualRevenue, unit: 'amount' }
    case 'gross_profit':
      return { actualValue: metrics.projectGrossProfit, unit: 'amount' }
    case 'gross_margin':
      return { actualValue: metrics.projectGrossMargin, unit: 'ratio' }
    case 'collection':
      return { actualValue: metrics.collectionRate, unit: 'ratio' }
    default:
      return { actualValue: null, unit: 'amount' }
  }
}

export function computeCompletionRate(
  actualValue: string | null,
  targetValue: string,
): string | null {
  if (actualValue === null) return null
  const actualCents = toMoneyCents(actualValue)
  const targetCents = toMoneyCents(targetValue)
  if (targetCents === 0n) return null
  return ratioOrNull(actualCents, targetCents)
}

export function computeMetricActuals(
  facts: DatedCommercialFacts,
  periodType: PeriodType,
  periodKey: string,
  metricKey: MetricKey,
  asOf: string,
): { actualValue: string | null; unit: 'amount' | 'ratio'; actualSource: 'commercial.metrics' | 'projects' } {
  const filtered = filterFactsByPeriod(facts, periodType, periodKey)
  filtered.asOf = asOf
  const metrics = computeCommercialMetrics(filtered)
  const resolved = resolveActualForMetric(metrics, metricKey)
  return {
    ...resolved,
    actualSource: 'commercial.metrics',
  }
}

export function buildCompletionItem(input: {
  organizationId: string
  metricKey: MetricKey
  targetValue: string | null
  actualValue: string | null
  unit: 'amount' | 'ratio'
  currencyCode: string | null
  actualSource: 'commercial.metrics' | 'projects'
}): CompletionItem {
  const completionRate =
    input.targetValue && input.actualValue
      ? computeCompletionRate(input.actualValue, input.targetValue)
      : null
  return {
    organizationId: input.organizationId,
    metricKey: input.metricKey,
    targetValue: input.targetValue,
    actualValue: input.actualValue,
    completionRate,
    unit: input.unit,
    currencyCode: input.currencyCode,
    actualSource: input.actualSource,
  }
}
  facts: DatedCommercialFacts,
  periodType: PeriodType,
  periodKey: string,
  asOf: string,
): {
  revenue: string
  grossProfit: string
  collectionNumerator: string
  collectionDenominator: string
} {
  const filtered = filterFactsByPeriod(facts, periodType, periodKey)
  filtered.asOf = asOf
  const metrics = computeCommercialMetrics(filtered)
  const invoiceCents = sumMoneyCents(filtered.invoices.map((row) => row.amount))
  const allocCents = sumMoneyCents(filtered.allocations.map((row) => row.allocatedAmount))
  return {
    revenue: metrics.actualRevenue,
    grossProfit: metrics.projectGrossProfit,
    collectionNumerator: fromMoneyCents(allocCents),
    collectionDenominator: fromMoneyCents(invoiceCents),
  }
}
