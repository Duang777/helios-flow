import type { FilterQuery } from '@mikro-orm/core'
import {
  CustomerActivity,
  CustomerDeal,
  CustomerInteraction,
} from '../../../customers/data/entities'
import type { RuleCandidate, RuleRunContext } from './upsert'

export const RULE_DEAL_STALE = 'gov.deal_stale'
const STALE_DAYS = 60

function daysBetween(from: Date, to: Date): number {
  const fromDay = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const toDay = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  return Math.floor((toDay - fromDay) / (24 * 60 * 60 * 1000))
}

export async function runDealStaleRule(ctx: RuleRunContext): Promise<RuleCandidate[]> {
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

  const dealIds = deals.map((row) => row.id)
  const [activities, interactions] = await Promise.all([
    ctx.em.find(
      CustomerActivity,
      {
        tenantId: ctx.tenantId,
        organizationId: ctx.organizationId,
        deal: { $in: dealIds },
      } as FilterQuery<CustomerActivity>,
    ),
    ctx.em.find(
      CustomerInteraction,
      {
        tenantId: ctx.tenantId,
        organizationId: ctx.organizationId,
        deletedAt: null,
        dealId: { $in: dealIds },
      } as FilterQuery<CustomerInteraction>,
    ),
  ])

  const lastTouchByDeal = new Map<string, Date>()
  for (const activity of activities) {
    const dealRef = activity.deal
    const dealId = typeof dealRef === 'string' ? dealRef : dealRef?.id
    if (!dealId) continue
    const touchAt = activity.occurredAt ?? activity.createdAt
    const previous = lastTouchByDeal.get(dealId)
    if (!previous || touchAt > previous) lastTouchByDeal.set(dealId, touchAt)
  }
  for (const interaction of interactions) {
    if (!interaction.dealId) continue
    const touchAt = interaction.occurredAt ?? interaction.scheduledAt ?? interaction.createdAt
    if (!touchAt) continue
    const previous = lastTouchByDeal.get(interaction.dealId)
    if (!previous || touchAt > previous) lastTouchByDeal.set(interaction.dealId, touchAt)
  }

  const asOfDate = new Date(`${ctx.asOf}T00:00:00.000Z`)
  const candidates: RuleCandidate[] = []
  for (const deal of deals) {
    const lastTouch = lastTouchByDeal.get(deal.id) ?? deal.updatedAt
    const staleDays = daysBetween(lastTouch, asOfDate)
    if (staleDays <= STALE_DAYS) continue

    candidates.push({
      ruleId: RULE_DEAL_STALE,
      severity: 'info',
      title: `Stale deal: ${deal.title}`,
      reason: `Open deal has no follow-up activity in ${staleDays} days (threshold ${STALE_DAYS}).`,
      evidenceIds: [{ type: 'deal', id: deal.id, module: 'customers' }],
      subjectType: 'deal',
      subjectId: deal.id,
      impactSummary: 'Pipeline deal may need owner follow-up.',
      ownerRole: 'sales_rep',
      payload: {
        staleDays,
        lastTouchAt: lastTouch.toISOString(),
        pipelineStage: deal.pipelineStage ?? null,
      },
    })
  }

  return candidates
}
