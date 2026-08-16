import type { FilterQuery } from '@mikro-orm/core'
import { Project } from '../../../projects/data/entities'
import { ProjectCost } from '../../../commercial/data/entities'
import { sumMoneyCents, toMoneyCents } from '../../../commercial/lib/metrics'
import type { RuleCandidate, RuleRunContext } from './upsert'

export const RULE_PROJECT_COST_OVER_BUDGET = 'gov.project_cost_over_budget'

export async function runProjectCostOverBudgetRule(ctx: RuleRunContext): Promise<RuleCandidate[]> {
  const projects = await ctx.em.find(
    Project,
    {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      deletedAt: null,
      budgetCost: { $ne: null },
    } as FilterQuery<Project>,
  )

  if (projects.length === 0) return []

  const projectIds = projects.map((row) => row.id)
  const costs = await ctx.em.find(
    ProjectCost,
    {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      deletedAt: null,
      dataVersion: 'actual',
      projectId: { $in: projectIds },
    } as FilterQuery<ProjectCost>,
  )

  const costByProject = new Map<string, string[]>()
  for (const cost of costs) {
    const bucket = costByProject.get(cost.projectId) ?? []
    bucket.push(cost.amount)
    costByProject.set(cost.projectId, bucket)
  }

  const candidates: RuleCandidate[] = []
  for (const project of projects) {
    const budget = project.budgetCost
    if (!budget) continue
    const actualAmounts = costByProject.get(project.id) ?? []
    const actualTotal = sumMoneyCents(actualAmounts)
    const budgetCents = toMoneyCents(budget)
    if (actualTotal <= budgetCents) continue

    candidates.push({
      ruleId: RULE_PROJECT_COST_OVER_BUDGET,
      severity: 'critical',
      title: `Project cost over budget: ${project.name}`,
      reason: `Actual cost exceeds budget (${budget} budget vs actual sum from project costs).`,
      evidenceIds: [
        { type: 'project', id: project.id, module: 'projects' },
        ...costs
          .filter((row) => row.projectId === project.id)
          .slice(0, 5)
          .map((row) => ({ type: 'project_cost', id: row.id, module: 'commercial' })),
      ],
      subjectType: 'project',
      subjectId: project.id,
      impactSummary: 'Project actual costs exceed the approved budget.',
      ownerRole: 'finance_ops',
      payload: {
        budgetCost: budget,
        actualCostCount: actualAmounts.length,
      },
    })
  }

  return candidates
}
