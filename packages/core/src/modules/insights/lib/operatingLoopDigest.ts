import type { FilterQuery } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import {
  CommercialContract,
  CommercialInvoice,
  PaymentAllocation,
  ProjectCost,
  ProjectRevenue,
} from '../../commercial/data/entities'
import { summarizeOverdueInvoices } from '../../commercial/lib/metrics'
import { GovernanceFinding } from '../../governance/data/entities'
import { ProjectMilestone } from '../../projects/data/entities'
import { isMilestoneDelayed } from '../../projects/lib/milestoneDelay'
import { KpiTarget } from '../data/entities'
import { metricKeySchema, periodTypeSchema } from '../data/validators'
import {
  buildCompletionItem,
  computeMetricActuals,
  parsePeriodRange,
  type DatedCommercialFacts,
  type MetricKey,
  type PeriodType,
} from './completion'

export const OPERATING_LOOP_DIGEST_NOTIFICATION_TYPE = 'insights.operating_loop.digest'
export const OPERATING_LOOP_DIGEST_LINK = '/backend/insights/operating-loop/today'
export const OPERATING_LOOP_DIGEST_FORMULA_SOURCES =
  'governance.findings, projects.milestones, commercial.metrics, insights.kpi.completion'

export type OperatingLoopDigestScope = {
  tenantId: string
  organizationId: string
  asOf: string
}

export type OperatingLoopDigestMetrics = {
  criticalFindingCount: number
  delayedProjectCount: number
  overdueInvoiceCount: number
  overdueOutstanding: string
  kpiGapCount: number
  periodType: Extract<PeriodType, 'month'>
  periodKey: string
}

export type OperatingLoopDigestNotification = {
  bodyVariables: Record<string, string>
  groupKey: string
  linkHref: string
  sourceEntityType: 'insights.operating_loop'
  sourceEntityId: string
}

export function resolveOperatingLoopDigestPeriod(
  asOf: string,
): Pick<OperatingLoopDigestMetrics, 'periodType' | 'periodKey'> {
  return {
    periodType: 'month',
    periodKey: asOf.slice(0, 7),
  }
}

export function buildOperatingLoopDigestNotification(input: {
  organizationId: string
  asOf: string
  metrics: OperatingLoopDigestMetrics
}): OperatingLoopDigestNotification | null {
  const hasSignal =
    input.metrics.criticalFindingCount > 0 ||
    input.metrics.delayedProjectCount > 0 ||
    input.metrics.overdueInvoiceCount > 0 ||
    input.metrics.kpiGapCount > 0

  if (!hasSignal) return null

  return {
    bodyVariables: {
      asOf: input.asOf,
      criticalFindingCount: String(input.metrics.criticalFindingCount),
      delayedProjectCount: String(input.metrics.delayedProjectCount),
      overdueInvoiceCount: String(input.metrics.overdueInvoiceCount),
      overdueOutstanding: input.metrics.overdueOutstanding,
      kpiGapCount: String(input.metrics.kpiGapCount),
      periodKey: input.metrics.periodKey,
      formulaSources: OPERATING_LOOP_DIGEST_FORMULA_SOURCES,
    },
    groupKey: `insights.operating_loop:${input.organizationId}:${input.asOf}`,
    linkHref: OPERATING_LOOP_DIGEST_LINK,
    sourceEntityType: 'insights.operating_loop',
    sourceEntityId: input.organizationId,
  }
}

export async function loadOperatingLoopCommercialFacts(
  em: EntityManager,
  scope: OperatingLoopDigestScope,
): Promise<DatedCommercialFacts> {
  const scopeFilter = {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
  }

  const [revenues, costs, contracts, invoices, allocations] = await Promise.all([
    em.find(ProjectRevenue, scopeFilter as FilterQuery<ProjectRevenue>),
    em.find(ProjectCost, scopeFilter as FilterQuery<ProjectCost>),
    em.find(CommercialContract, scopeFilter as FilterQuery<CommercialContract>),
    em.find(CommercialInvoice, scopeFilter as FilterQuery<CommercialInvoice>),
    em.find(PaymentAllocation, scopeFilter as FilterQuery<PaymentAllocation>),
  ])

  return {
    revenues: revenues.map((row) => ({
      amount: row.amount,
      dataVersion: row.dataVersion,
      recognizedOn: row.recognizedOn,
    })),
    costs: costs.map((row) => ({
      amount: row.amount,
      dataVersion: row.dataVersion,
      incurredOn: row.incurredOn,
    })),
    contracts: contracts.map((row) => ({
      amount: row.amount,
      status: row.status,
      startDate: row.startDate ?? null,
    })),
    invoices: invoices.map((row) => ({
      id: row.id,
      amount: row.amount,
      dueDate: row.dueDate ?? null,
      status: row.status,
      issuedOn: row.issuedOn,
    })),
    allocations: allocations.map((row) => ({
      invoiceId: row.invoiceId,
      allocatedAmount: row.allocatedAmount,
      allocatedOn: row.allocatedOn ?? null,
    })),
  }
}

function countKpiGaps(input: {
  organizationId: string
  asOf: string
  targets: KpiTarget[]
  facts: DatedCommercialFacts
}): number {
  let gapCount = 0
  for (const target of input.targets) {
    const parsedMetricKey = metricKeySchema.safeParse(target.metricKey)
    if (!parsedMetricKey.success) continue

    const activePeriod = resolveKpiTargetActivePeriod(target, input.asOf)
    if (!activePeriod) continue

    const metricKey: MetricKey = parsedMetricKey.data
    const actuals = computeMetricActuals(input.facts, activePeriod.periodType, activePeriod.periodKey, metricKey, input.asOf)
    const item = buildCompletionItem({
      organizationId: input.organizationId,
      metricKey,
      targetValue: target.targetValue,
      actualValue: actuals.actualValue,
      unit: actuals.unit,
      currencyCode: target.currencyCode ?? (actuals.unit === 'amount' ? 'CNY' : null),
      actualSource: actuals.actualSource,
    })

    if (item.completionRate === null || Number(item.completionRate) < 100) {
      gapCount += 1
    }
  }
  return gapCount
}

export function resolveKpiTargetActivePeriod(
  target: Pick<KpiTarget, 'periodType' | 'periodKey'>,
  asOf: string,
): { periodType: PeriodType; periodKey: string } | null {
  const parsedPeriodType = periodTypeSchema.safeParse(target.periodType)
  if (!parsedPeriodType.success) return null
  try {
    const period = parsePeriodRange(parsedPeriodType.data, target.periodKey)
    if (period.start <= asOf && asOf <= period.end) {
      return { periodType: parsedPeriodType.data, periodKey: target.periodKey }
    }
    return null
  } catch {
    return null
  }
}

export function isKpiTargetActiveOn(target: Pick<KpiTarget, 'periodType' | 'periodKey'>, asOf: string): boolean {
  return resolveKpiTargetActivePeriod(target, asOf) !== null
}

async function countDelayedProjects(em: EntityManager, scope: OperatingLoopDigestScope): Promise<number> {
  const milestones = await em.find(ProjectMilestone, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
    isActive: true,
  } as FilterQuery<ProjectMilestone>)

  const asOf = new Date(`${scope.asOf}T00:00:00.000Z`)
  const delayedProjectIds = new Set<string>()
  for (const milestone of milestones) {
    if (
      isMilestoneDelayed({
        plannedDate: milestone.plannedDate ?? null,
        actualDate: milestone.actualDate ?? null,
        status: milestone.status,
        asOf,
      })
    ) {
      delayedProjectIds.add(milestone.projectId)
    }
  }

  return delayedProjectIds.size
}

export async function collectOperatingLoopDigestMetrics(
  em: EntityManager,
  scope: OperatingLoopDigestScope,
): Promise<OperatingLoopDigestMetrics> {
  const period = resolveOperatingLoopDigestPeriod(scope.asOf)
  const facts = await loadOperatingLoopCommercialFacts(em, scope)

  const [criticalFindingCount, delayedProjectCount, targets] = await Promise.all([
    em.count(GovernanceFinding, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      asOf: scope.asOf,
      severity: 'critical',
      status: 'open',
      deletedAt: null,
    } as FilterQuery<GovernanceFinding>),
    countDelayedProjects(em, scope),
    em.find(KpiTarget, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      isActive: true,
      deletedAt: null,
    } as FilterQuery<KpiTarget>),
  ])

  const overdueSummary = summarizeOverdueInvoices({
    asOf: scope.asOf,
    invoices: facts.invoices,
    allocations: facts.allocations,
  })

  return {
    criticalFindingCount,
    delayedProjectCount,
    overdueInvoiceCount: overdueSummary.overdueInvoiceCount,
    overdueOutstanding: overdueSummary.overdueOutstanding,
    kpiGapCount: countKpiGaps({
      organizationId: scope.organizationId,
      asOf: scope.asOf,
      targets: targets.filter((target) => isKpiTargetActiveOn(target, scope.asOf)),
      facts,
    }),
    ...period,
  }
}
