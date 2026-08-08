import type { EntityManager } from '@mikro-orm/postgresql'
import { runAllocationOverInvoiceRule } from './allocation_over_invoice'
import { runDealStaleRule } from './deal_stale'
import { runInvoiceOverdueOutstandingRule } from './invoice_overdue_outstanding'
import { runProjectCostOverBudgetRule } from './project_cost_over_budget'
import { runProjectMilestoneDelayedRule } from './project_milestone_delayed'
import { runRevenueWithoutCostRule } from './revenue_without_cost'
import { upsertRuleCandidates, type UpsertFindingResult } from './upsert'

export type GovernanceRulesRunSummary = UpsertFindingResult & {
  asOf: string
  ruleCount: number
  candidateCount: number
}

const RULE_RUNNERS = [
  runProjectMilestoneDelayedRule,
  runProjectCostOverBudgetRule,
  runRevenueWithoutCostRule,
  runInvoiceOverdueOutstandingRule,
  runAllocationOverInvoiceRule,
  runDealStaleRule,
]

export async function runGovernanceRulePack(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string; asOf: string },
): Promise<GovernanceRulesRunSummary> {
  const ctx = { em, ...scope }
  const allCandidates = (
    await Promise.all(RULE_RUNNERS.map((runner) => runner(ctx)))
  ).flat()

  const upsertResult = await upsertRuleCandidates(em, scope, allCandidates)
  return {
    ...upsertResult,
    asOf: scope.asOf,
    ruleCount: RULE_RUNNERS.length,
    candidateCount: allCandidates.length,
  }
}

export {
  runProjectMilestoneDelayedRule,
  runProjectCostOverBudgetRule,
  runRevenueWithoutCostRule,
  runInvoiceOverdueOutstandingRule,
  runAllocationOverInvoiceRule,
  runDealStaleRule,
}
