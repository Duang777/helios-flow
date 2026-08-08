import type { FilterQuery } from '@mikro-orm/core'
import { Project } from '../../../projects/data/entities'
import { ProjectCost, ProjectRevenue } from '../../../commercial/data/entities'
import { sumMoneyCents } from '../../../commercial/lib/metrics'
import type { RuleCandidate, RuleRunContext } from './upsert'

export const RULE_REVENUE_WITHOUT_COST = 'gov.revenue_without_cost'

export async function runRevenueWithoutCostRule(ctx: RuleRunContext): Promise<RuleCandidate[]> {
  const projects = await ctx.em.find(
    Project,
    {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      deletedAt: null,
    } as FilterQuery<Project>,
  )
  if (projects.length === 0) return []

  const projectIds = projects.map((row) => row.id)
  const scope = {
    tenantId: ctx.tenantId,
    organizationId: ctx.organizationId,
    deletedAt: null,
    dataVersion: 'actual',
    projectId: { $in: projectIds },
  }

  const [revenues, costs] = await Promise.all([
    ctx.em.find(ProjectRevenue, scope as FilterQuery<ProjectRevenue>),
    ctx.em.find(ProjectCost, scope as FilterQuery<ProjectCost>),
  ])

  const revenueByProject = new Map<string, string[]>()
  for (const row of revenues) {
    const bucket = revenueByProject.get(row.projectId) ?? []
    bucket.push(row.amount)
    revenueByProject.set(row.projectId, bucket)
  }

  const costByProject = new Map<string, string[]>()
  for (const row of costs) {
    const bucket = costByProject.get(row.projectId) ?? []
    bucket.push(row.amount)
    costByProject.set(row.projectId, bucket)
  }

  const candidates: RuleCandidate[] = []
  for (const project of projects) {
    const revenueAmounts = revenueByProject.get(project.id) ?? []
    if (revenueAmounts.length === 0) continue
    const revenueTotal = sumMoneyCents(revenueAmounts)
    if (revenueTotal === 0n) continue

    const costAmounts = costByProject.get(project.id) ?? []
    const costTotal = sumMoneyCents(costAmounts)
    if (costTotal > 0n) continue

    const evidenceRevenues = revenues.filter((row) => row.projectId === project.id).slice(0, 3)
    candidates.push({
      ruleId: RULE_REVENUE_WITHOUT_COST,
      severity: 'warning',
      title: `Revenue without cost: ${project.name}`,
      reason: 'Project has recognized actual revenue but zero actual cost rows.',
      evidenceIds: [
        { type: 'project', id: project.id, module: 'projects' },
        ...evidenceRevenues.map((row) => ({ type: 'project_revenue', id: row.id, module: 'commercial' })),
      ],
      subjectType: 'project',
      subjectId: project.id,
      impactSummary: 'Margin cannot be verified without matching cost facts.',
      ownerRole: 'finance_ops',
      payload: { revenueRowCount: revenueAmounts.length },
    })
  }

  return candidates
}
