import type { FilterQuery } from '@mikro-orm/core'
import { Project, ProjectMilestone } from '../../../projects/data/entities'
import type { RuleCandidate, RuleRunContext } from './upsert'

export const RULE_PROJECT_STATUS_CONFLICT = 'gov.project_status_conflict'

const OPEN_MILESTONE_STATUSES = new Set(['planned', 'in_progress'])

export async function runProjectStatusConflictRule(ctx: RuleRunContext): Promise<RuleCandidate[]> {
  const projects = await ctx.em.find(
    Project,
    {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      deletedAt: null,
      status: 'completed',
    } as FilterQuery<Project>,
  )
  if (projects.length === 0) return []

  const milestones = await ctx.em.find(
    ProjectMilestone,
    {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      deletedAt: null,
      projectId: { $in: projects.map((row) => row.id) },
    } as FilterQuery<ProjectMilestone>,
  )

  const openByProject = new Map<string, ProjectMilestone[]>()
  for (const milestone of milestones) {
    if (!OPEN_MILESTONE_STATUSES.has(milestone.status)) continue
    const bucket = openByProject.get(milestone.projectId) ?? []
    bucket.push(milestone)
    openByProject.set(milestone.projectId, bucket)
  }

  const candidates: RuleCandidate[] = []
  for (const project of projects) {
    const openMilestones = openByProject.get(project.id) ?? []
    if (openMilestones.length === 0) continue

    candidates.push({
      ruleId: RULE_PROJECT_STATUS_CONFLICT,
      severity: 'warning',
      title: `Completed project still has open milestones: ${project.name}`,
      reason: `Project status is completed but ${openMilestones.length} milestone(s) remain planned/in_progress.`,
      evidenceIds: [
        { type: 'project', id: project.id, module: 'projects' },
        ...openMilestones.slice(0, 5).map((milestone) => ({
          type: 'milestone' as const,
          id: milestone.id,
          module: 'projects' as const,
        })),
      ],
      subjectType: 'project',
      subjectId: project.id,
      impactSummary: 'Delivery status and milestone completion disagree.',
      ownerRole: 'project_manager',
      payload: {
        openMilestoneCount: openMilestones.length,
        openMilestoneIds: openMilestones.map((row) => row.id),
      },
    })
  }

  return candidates
}
