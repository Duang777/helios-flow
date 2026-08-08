import { fromMoneyCents, ratioOrNull, sumMoneyCents, toMoneyCents } from '../../commercial/lib/metrics'
import type { MetricKey } from './completion'

export type RollupChildAmounts = {
  organizationId: string
  metricKey: MetricKey
  targetValue: string | null
  actualValue: string | null
  unit: 'amount' | 'ratio'
  currencyCode: string | null
  revenueActual?: string
  grossProfitActual?: string
  collectionAllocated?: string
  collectionInvoiced?: string
}

export type RollupResult = {
  organizationId: string
  metricKey: MetricKey
  targetValue: string | null
  actualValue: string | null
  completionRate: string | null
  unit: 'amount' | 'ratio'
  currencyCode: string | null
  isRollup: true
}

function computeCompletionRate(actualValue: string | null, targetValue: string | null): string | null {
  if (actualValue === null || targetValue === null) return null
  const actualCents = toMoneyCents(actualValue)
  const targetCents = toMoneyCents(targetValue)
  if (targetCents === 0n) return null
  return ratioOrNull(actualCents, targetCents)
}

export function rollupAmountMetric(
  parentOrganizationId: string,
  metricKey: MetricKey,
  children: RollupChildAmounts[],
  currencyCode: string | null,
): RollupResult {
  const withTargets = children.filter((child) => child.targetValue)
  const withActuals = children.filter((child) => child.actualValue)
  const targetValue =
    withTargets.length > 0 ? fromMoneyCents(sumMoneyCents(withTargets.map((child) => child.targetValue!))) : null
  const actualValue =
    withActuals.length > 0 ? fromMoneyCents(sumMoneyCents(withActuals.map((child) => child.actualValue!))) : null
  return {
    organizationId: parentOrganizationId,
    metricKey,
    targetValue,
    actualValue,
    completionRate: computeCompletionRate(actualValue, targetValue),
    unit: 'amount',
    currencyCode,
    isRollup: true,
  }
}

export function rollupGrossMargin(
  parentOrganizationId: string,
  children: RollupChildAmounts[],
): RollupResult {
  const profitCents = sumMoneyCents(
    children.map((child) => child.grossProfitActual ?? '0').filter((value) => value !== '0'),
  )
  const revenueCents = sumMoneyCents(
    children.map((child) => child.revenueActual ?? '0').filter((value) => value !== '0'),
  )
  const actualValue = ratioOrNull(profitCents, revenueCents)
  const ratioTargets = children.filter((child) => child.targetValue && child.revenueActual)
  let targetValue: string | null = null
  if (ratioTargets.length > 0 && revenueCents > 0n) {
    let weightedNumerator = 0n
    for (const child of ratioTargets) {
      const weight = toMoneyCents(child.revenueActual!)
      const target = toMoneyCents(child.targetValue!)
      weightedNumerator += (weight * target) / 100n
    }
    targetValue = ratioOrNull(weightedNumerator, revenueCents)
  }
  return {
    organizationId: parentOrganizationId,
    metricKey: 'gross_margin',
    targetValue,
    actualValue,
    completionRate: computeCompletionRate(actualValue, targetValue),
    unit: 'ratio',
    currencyCode: null,
    isRollup: true,
  }
}

export function rollupCollection(
  parentOrganizationId: string,
  children: RollupChildAmounts[],
): RollupResult {
  const allocatedCents = sumMoneyCents(
    children.map((child) => child.collectionAllocated ?? '0').filter((value) => value !== '0'),
  )
  const invoiceCents = sumMoneyCents(
    children.map((child) => child.collectionInvoiced ?? '0').filter((value) => value !== '0'),
  )
  const actualValue = ratioOrNull(allocatedCents, invoiceCents)
  const ratioTargets = children.filter((child) => child.targetValue && child.collectionInvoiced)
  let targetValue: string | null = null
  if (ratioTargets.length > 0 && invoiceCents > 0n) {
    let weightedNumerator = 0n
    for (const child of ratioTargets) {
      const weight = toMoneyCents(child.collectionInvoiced!)
      const target = toMoneyCents(child.targetValue!)
      weightedNumerator += (weight * target) / 100n
    }
    targetValue = ratioOrNull(weightedNumerator, invoiceCents)
  }
  return {
    organizationId: parentOrganizationId,
    metricKey: 'collection',
    targetValue,
    actualValue,
    completionRate: computeCompletionRate(actualValue, targetValue),
    unit: 'ratio',
    currencyCode: null,
    isRollup: true,
  }
}

export function rollupChildren(
  parentOrganizationId: string,
  metricKey: MetricKey,
  children: RollupChildAmounts[],
  currencyCode: string | null,
): RollupResult {
  if (metricKey === 'gross_margin') return rollupGrossMargin(parentOrganizationId, children)
  if (metricKey === 'collection') return rollupCollection(parentOrganizationId, children)
  return rollupAmountMetric(parentOrganizationId, metricKey, children, currencyCode)
}

export function resolveChildOrganizationIds(
  parentOrganizationId: string,
  childIds: string[],
  descendantIds: string[],
): string[] {
  const directChildren = childIds.filter((id) => id !== parentOrganizationId)
  if (directChildren.length > 0) return directChildren
  return descendantIds.filter((id) => id !== parentOrganizationId)
}
