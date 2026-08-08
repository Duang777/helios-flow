import type { FilterQuery } from '@mikro-orm/core'
import { CustomerDeal, CustomerPipelineStage } from '../../../customers/data/entities'
import type { RuleCandidate, RuleRunContext } from './upsert'

export const RULE_DEAL_STAGE_PROBABILITY_CONFLICT = 'gov.deal_stage_probability_conflict'

type ProbabilityBand = { min: number; max: number; label: string }

export function bandForStageName(stageName: string): ProbabilityBand | null {
  const name = stageName.trim().toLowerCase()
  if (!name) return null
  if (/(won|closed.?won|已赢|赢单|签约完成)/.test(name)) {
    return { min: 90, max: 100, label: 'closed-won' }
  }
  if (/(lost|closed.?lost|丢单|已丢)/.test(name)) {
    return { min: 0, max: 5, label: 'closed-lost' }
  }
  if (/(negotiat|合同|签约|contract)/.test(name)) {
    return { min: 50, max: 95, label: 'negotiation' }
  }
  if (/(proposal|quote|报价|方案)/.test(name)) {
    return { min: 25, max: 65, label: 'proposal' }
  }
  if (/(qual|lead|线索|初步|discovery|discover)/.test(name)) {
    return { min: 0, max: 35, label: 'qualification' }
  }
  return null
}

export async function runDealStageProbabilityConflictRule(
  ctx: RuleRunContext,
): Promise<RuleCandidate[]> {
  const deals = await ctx.em.find(
    CustomerDeal,
    {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      deletedAt: null,
      status: 'open',
    } as FilterQuery<CustomerDeal>,
  )
  if (deals.length === 0) return []

  const stageIds = deals
    .map((deal) => deal.pipelineStageId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  const stages =
    stageIds.length === 0
      ? []
      : await ctx.em.find(
          CustomerPipelineStage,
          {
            tenantId: ctx.tenantId,
            organizationId: ctx.organizationId,
            id: { $in: stageIds },
          } as FilterQuery<CustomerPipelineStage>,
        )
  const stageById = new Map(stages.map((stage) => [stage.id, stage]))

  const candidates: RuleCandidate[] = []
  for (const deal of deals) {
    if (typeof deal.probability !== 'number') continue
    const stageName =
      (deal.pipelineStageId ? stageById.get(deal.pipelineStageId)?.label : null) ??
      deal.pipelineStage ??
      ''
    const band = bandForStageName(stageName)
    if (!band) continue
    if (deal.probability >= band.min && deal.probability <= band.max) continue

    candidates.push({
      ruleId: RULE_DEAL_STAGE_PROBABILITY_CONFLICT,
      severity: 'info',
      title: `Stage/probability mismatch: ${deal.title}`,
      reason: `Deal probability ${deal.probability}% is outside the expected ${band.min}-${band.max}% band for stage "${stageName}" (${band.label}).`,
      evidenceIds: [{ type: 'deal', id: deal.id, module: 'customers' }],
      subjectType: 'deal',
      subjectId: deal.id,
      impactSummary: 'Pipeline forecasting may be inconsistent with stage semantics.',
      ownerRole: 'sales_rep',
      payload: {
        probability: deal.probability,
        pipelineStage: stageName,
        expectedMin: band.min,
        expectedMax: band.max,
        bandLabel: band.label,
      },
    })
  }

  return candidates
}
