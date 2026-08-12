import type { FilterQuery } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { fromMoneyCents, isOperatingInvoiceStatus, toMoneyCents } from '../../commercial/lib/metrics'
import { CommercialInvoice, PaymentAllocation } from '../../commercial/data/entities'
import { GovernanceFinding, type GovernanceEvidenceItem } from '../../governance/data/entities'
import { Project, ProjectMilestone } from '../../projects/data/entities'
import { isMilestoneDelayed } from '../../projects/lib/milestoneDelay'
import { KpiTarget } from '../data/entities'
import { metricKeySchema } from '../data/validators'
import {
  buildCompletionItem,
  computeMetricActuals,
  type CompletionItem,
  type MetricKey,
} from './completion'
import {
  collectOperatingLoopDigestMetrics,
  isKpiTargetActiveOn,
  loadOperatingLoopCommercialFacts,
  OPERATING_LOOP_DIGEST_FORMULA_SOURCES,
  resolveKpiTargetActivePeriod,
  resolveOperatingLoopDigestPeriod,
  type OperatingLoopDigestMetrics,
  type OperatingLoopDigestScope,
} from './operatingLoopDigest'

export type OperatingLoopDigestGroupKey =
  | 'criticalFindings'
  | 'overdueInvoices'
  | 'delayedProjects'
  | 'kpiGaps'

export type OperatingLoopDigestGroupStatus = {
  ok: boolean
  message?: string
}

export type OperatingLoopDigestDetail = {
  id: string
  title: string
  description: string | null
  severity: 'critical' | 'warning' | 'info'
  entityType:
    | 'governance.finding'
    | 'commercial.invoice'
    | 'projects.project'
    | 'insights.kpi_target'
  recordId: string
  organizationId: string
  href: string
  formulaSource: string
  amount: string | null
  currencyCode: string | null
  evidenceIds: GovernanceEvidenceItem[]
  scopedIds: {
    projectId?: string
    milestoneId?: string
    contractId?: string
    invoiceId?: string
    kpiTargetId?: string
    findingId?: string
    customerEntityId?: string
  }
  facts: Record<string, string | number | null>
}

export type OperatingLoopTodayDigest = {
  asOf: string
  periodType: OperatingLoopDigestMetrics['periodType']
  periodKey: string
  formulaSources: string
  metrics: OperatingLoopDigestMetrics
  groups: Record<OperatingLoopDigestGroupKey, OperatingLoopDigestDetail[]>
  sourceStatus: Record<OperatingLoopDigestGroupKey, OperatingLoopDigestGroupStatus>
}

type GroupResult = {
  items: OperatingLoopDigestDetail[]
  status: OperatingLoopDigestGroupStatus
}

type SafeGroupCollector = () => Promise<OperatingLoopDigestDetail[]>

function backendHref(path: string): string {
  return `/backend/${path.replace(/^\/+/, '')}`
}

function normalizeErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message
  return 'Unknown operating digest source error'
}

async function collectSafeGroup(collector: SafeGroupCollector): Promise<GroupResult> {
  try {
    return {
      items: await collector(),
      status: { ok: true },
    }
  } catch (err) {
    return {
      items: [],
      status: { ok: false, message: normalizeErrorMessage(err) },
    }
  }
}

function buildAllocationTotals(allocations: PaymentAllocation[]): Map<string, bigint> {
  const totals = new Map<string, bigint>()
  for (const allocation of allocations) {
    const previous = totals.get(allocation.invoiceId) ?? 0n
    totals.set(allocation.invoiceId, previous + toMoneyCents(allocation.allocatedAmount))
  }
  return totals
}

async function collectCriticalFindings(
  em: EntityManager,
  scope: OperatingLoopDigestScope,
): Promise<OperatingLoopDigestDetail[]> {
  const findings = await em.find(
    GovernanceFinding,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      asOf: scope.asOf,
      severity: 'critical',
      status: 'open',
      deletedAt: null,
    } as FilterQuery<GovernanceFinding>,
    { orderBy: { detectedAt: 'desc' }, limit: 20 },
  )

  return findings.map((finding) => ({
    id: finding.id,
    title: finding.title,
    description: finding.reason,
    severity: 'critical',
    entityType: 'governance.finding',
    recordId: finding.id,
    organizationId: finding.organizationId,
    href: backendHref(`governance/findings/${finding.id}`),
    formulaSource: `governance.findings rule=${finding.ruleId}`,
    amount: null,
    currencyCode: null,
    evidenceIds: Array.isArray(finding.evidenceIds) ? finding.evidenceIds : [],
    scopedIds: {
      findingId: finding.id,
      ...(finding.subjectType === 'projects.project' ? { projectId: finding.subjectId } : {}),
      ...(finding.subjectType === 'commercial.invoice' ? { invoiceId: finding.subjectId } : {}),
    },
    facts: {
      ruleId: finding.ruleId,
      severity: finding.severity,
      status: finding.status,
      asOf: finding.asOf,
    },
  }))
}

async function collectOverdueInvoices(
  em: EntityManager,
  scope: OperatingLoopDigestScope,
): Promise<OperatingLoopDigestDetail[]> {
  const scopeFilter = {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
  }
  const [invoices, allocations] = await Promise.all([
    em.find(CommercialInvoice, scopeFilter as FilterQuery<CommercialInvoice>, {
      orderBy: { dueDate: 'asc', issuedOn: 'desc' },
      limit: 100,
    }),
    em.find(PaymentAllocation, scopeFilter as FilterQuery<PaymentAllocation>),
  ])
  const allocationTotals = buildAllocationTotals(allocations)

  return invoices
    .filter((invoice) => isOperatingInvoiceStatus(invoice.status))
    .map((invoice) => {
      const invoiceCents = toMoneyCents(invoice.amount)
      const allocatedCents = allocationTotals.get(invoice.id) ?? 0n
      return { invoice, remainderCents: invoiceCents - allocatedCents }
    })
    .filter(({ invoice, remainderCents }) => remainderCents > 0n && Boolean(invoice.dueDate) && invoice.dueDate! < scope.asOf)
    .slice(0, 20)
    .map(({ invoice, remainderCents }) => ({
      id: invoice.id,
      title: invoice.invoiceNo ?? invoice.id.slice(0, 8),
      description: null,
      severity: 'warning',
      entityType: 'commercial.invoice',
      recordId: invoice.id,
      organizationId: invoice.organizationId,
      href: backendHref(`commercial/invoices/${invoice.id}`),
      formulaSource:
        'commercial.metrics overdueOutstanding = Σ (issued invoice − allocated) where due_date < asOf and remainder > 0',
      amount: fromMoneyCents(remainderCents),
      currencyCode: invoice.currencyCode,
      evidenceIds: [],
      scopedIds: {
        invoiceId: invoice.id,
        ...(invoice.projectId ? { projectId: invoice.projectId } : {}),
        ...(invoice.contractId ? { contractId: invoice.contractId } : {}),
        ...(invoice.customerEntityId ? { customerEntityId: invoice.customerEntityId } : {}),
      },
      facts: {
        invoiceAmount: invoice.amount,
        outstanding: fromMoneyCents(remainderCents),
        dueDate: invoice.dueDate ?? null,
        status: invoice.status,
      },
    }))
}

async function collectDelayedProjects(
  em: EntityManager,
  scope: OperatingLoopDigestScope,
): Promise<OperatingLoopDigestDetail[]> {
  const milestones = await em.find(
    ProjectMilestone,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
      isActive: true,
    } as FilterQuery<ProjectMilestone>,
    { orderBy: { plannedDate: 'asc', sortOrder: 'asc' }, limit: 200 },
  )
  const asOf = new Date(`${scope.asOf}T00:00:00.000Z`)
  const delayedByProject = new Map<string, ProjectMilestone>()
  for (const milestone of milestones) {
    const delayed = isMilestoneDelayed({
      plannedDate: milestone.plannedDate ?? null,
      actualDate: milestone.actualDate ?? null,
      status: milestone.status,
      asOf,
    })
    if (delayed && !delayedByProject.has(milestone.projectId)) {
      delayedByProject.set(milestone.projectId, milestone)
    }
  }
  if (delayedByProject.size === 0) return []

  const projects = await em.find(Project, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    id: { $in: Array.from(delayedByProject.keys()) },
    deletedAt: null,
  } as FilterQuery<Project>)
  const projectsById = new Map(projects.map((project) => [project.id, project]))

  return Array.from(delayedByProject.values())
    .slice(0, 20)
    .map((milestone) => {
      const project = projectsById.get(milestone.projectId)
      const title = project?.name ?? milestone.projectId.slice(0, 8)
      return {
        id: milestone.projectId,
        title,
        description: milestone.name,
        severity: 'warning',
        entityType: 'projects.project',
        recordId: milestone.projectId,
        organizationId: milestone.organizationId,
        href: backendHref(`projects/${milestone.projectId}`),
        formulaSource: 'projects.milestones delayed when plannedDate < asOf and milestone is not completed',
        amount: null,
        currencyCode: null,
        evidenceIds: [{ type: 'projects.milestone', id: milestone.id, module: 'projects' }],
        scopedIds: {
          projectId: milestone.projectId,
          milestoneId: milestone.id,
          ...(project?.customerEntityId ? { customerEntityId: project.customerEntityId } : {}),
        },
        facts: {
          milestoneId: milestone.id,
          milestoneStatus: milestone.status,
          plannedDate: milestone.plannedDate ?? null,
          actualDate: milestone.actualDate ?? null,
        },
      }
    })
}

async function collectKpiGaps(
  em: EntityManager,
  scope: OperatingLoopDigestScope,
): Promise<OperatingLoopDigestDetail[]> {
  const period = resolveOperatingLoopDigestPeriod(scope.asOf)
  const [facts, targets] = await Promise.all([
    loadOperatingLoopCommercialFacts(em, scope),
    em.find(KpiTarget, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      isActive: true,
      deletedAt: null,
    } as FilterQuery<KpiTarget>),
  ])

  const items: CompletionItem[] = []
  const targetsByMetric = new Map<MetricKey, KpiTarget>()
  const activeTargets = targets.filter((target) => isKpiTargetActiveOn(target, scope.asOf))
  for (const target of activeTargets) {
    const parsedMetricKey = metricKeySchema.safeParse(target.metricKey)
    if (!parsedMetricKey.success) continue
    const activePeriod = resolveKpiTargetActivePeriod(target, scope.asOf)
    if (!activePeriod) continue
    const metricKey = parsedMetricKey.data
    targetsByMetric.set(metricKey, target)
    const actuals = computeMetricActuals(facts, activePeriod.periodType, activePeriod.periodKey, metricKey, scope.asOf)
    items.push(
      buildCompletionItem({
        organizationId: scope.organizationId,
        metricKey,
        targetValue: target.targetValue,
        actualValue: actuals.actualValue,
        unit: actuals.unit,
        currencyCode: target.currencyCode ?? (actuals.unit === 'amount' ? 'CNY' : null),
        actualSource: actuals.actualSource,
      }),
    )
  }

  return items
    .filter((item) => item.completionRate === null || Number(item.completionRate) < 100)
    .slice(0, 20)
    .map((item) => {
      const target = targetsByMetric.get(item.metricKey)
      const completionRate = item.completionRate ? `${item.completionRate}%` : null
      return {
        id: target?.id ?? `${scope.organizationId}:${item.metricKey}:${period.periodKey}`,
        title: item.metricKey,
        description: completionRate,
        severity: 'warning',
        entityType: 'insights.kpi_target',
        recordId: target?.id ?? scope.organizationId,
        organizationId: scope.organizationId,
        href: target
          ? backendHref(`insights/kpi-targets/${target.id}`)
          : backendHref(`insights/kpi?periodType=${period.periodType}&periodKey=${period.periodKey}`),
        formulaSource: `${item.actualSource} + insights.kpi.completion completionRate = actualValue ÷ targetValue`,
        amount: item.actualValue,
        currencyCode: item.currencyCode,
        evidenceIds: [],
        scopedIds: {
          ...(target ? { kpiTargetId: target.id } : {}),
        },
        facts: {
          metricKey: item.metricKey,
          targetValue: item.targetValue,
          actualValue: item.actualValue,
          completionRate: item.completionRate,
          periodType: target?.periodType ?? period.periodType,
          periodKey: target?.periodKey ?? period.periodKey,
        },
      }
    })
}

export async function collectOperatingLoopTodayDigest(
  em: EntityManager,
  scope: OperatingLoopDigestScope,
): Promise<OperatingLoopTodayDigest> {
  const metrics = await collectOperatingLoopDigestMetrics(em, scope)
  const [criticalFindings, overdueInvoices, delayedProjects, kpiGaps] = await Promise.all([
    collectSafeGroup(() => collectCriticalFindings(em, scope)),
    collectSafeGroup(() => collectOverdueInvoices(em, scope)),
    collectSafeGroup(() => collectDelayedProjects(em, scope)),
    collectSafeGroup(() => collectKpiGaps(em, scope)),
  ])

  return {
    asOf: scope.asOf,
    periodType: metrics.periodType,
    periodKey: metrics.periodKey,
    formulaSources: OPERATING_LOOP_DIGEST_FORMULA_SOURCES,
    metrics,
    groups: {
      criticalFindings: criticalFindings.items,
      overdueInvoices: overdueInvoices.items,
      delayedProjects: delayedProjects.items,
      kpiGaps: kpiGaps.items,
    },
    sourceStatus: {
      criticalFindings: criticalFindings.status,
      overdueInvoices: overdueInvoices.status,
      delayedProjects: delayedProjects.status,
      kpiGaps: kpiGaps.status,
    },
  }
}
