import type { FilterQuery } from '@mikro-orm/core'
import { ProjectMilestone } from '../../../projects/data/entities'
import { isMilestoneDelayed } from '../../../projects/lib/milestoneDelay'
import type { RuleCandidate, RuleRunContext } from './upsert'

export const RULE_PROJECT_MILESTONE_DELAYED = 'gov.project_milestone_delayed'

export async function runProjectMilestoneDelayedRule(ctx: RuleRunContext): Promise<RuleCandidate[]> {
  const asOfDate = new Date(`${ctx.asOf}T00:00:00.000Z`)
  const milestones = await ctx.em.find(
    ProjectMilestone,
    {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      deletedAt: null,
      isActive: true,
    } as FilterQuery<ProjectMilestone>,
  )

  const candidates: RuleCandidate[] = []
  for (const milestone of milestones) {
    if (
      !isMilestoneDelayed({
        plannedDate: milestone.plannedDate,
        actualDate: milestone.actualDate,
        status: milestone.status,
        asOf: asOfDate,
      })
    ) {
      continue
    }

    candidates.push({
      ruleId: RULE_PROJECT_MILESTONE_DELAYED,
      severity: 'warning',
      title: `Milestone delayed: ${milestone.name}`,
      reason: `Planned date ${milestone.plannedDate ?? 'unknown'} is before as-of ${ctx.asOf} with no actual completion date.`,
      evidenceIds: [
        { type: 'milestone', id: milestone.id, module: 'projects' },
        { type: 'project', id: milestone.projectId, module: 'projects' },
      ],
      subjectType: 'milestone',
      subjectId: milestone.id,
      impactSummary: 'Delivery milestone is overdue.',
      ownerRole: 'project_manager',
      payload: {
        projectId: milestone.projectId,
        plannedDate: milestone.plannedDate,
        status: milestone.status,
      },
    })
  }

  return candidates
}
