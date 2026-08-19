/**
 * Human-readable explanations for the governance rule pack.
 *
 * The rule runners in this folder only emit `reason`/`severity`/`ownerRole` on
 * individual findings at runtime. There is no surface that explains *why* a
 * rule exists or *how* it triggers. This registry is the read-only "口径"
 * source for `governance.explain_rule`, so the operating-loop assistant can
 * answer "这条规则为什么触发 / 判定阈值是什么" without re-deriving it from code.
 */

export type RuleExplanation = {
  ruleId: string
  title: string
  severity: 'critical' | 'warning' | 'info'
  ownerRole: string
  impactSummary: string
  /** Plain-language description of when the rule produces a finding. */
  trigger: string
  /** Evidence record types attached to findings from this rule. */
  evidenceTypes: string[]
  href: string
}

export const RULE_EXPLANATIONS: Record<string, RuleExplanation> = {
  'gov.allocation_over_invoice': {
    ruleId: 'gov.allocation_over_invoice',
    title: 'Allocations exceed invoice',
    severity: 'critical',
    ownerRole: 'finance_ops',
    impactSummary: 'Over-allocation by the difference amount — legacy data integrity risk.',
    trigger:
      'When the sum of payment allocations applied to a single invoice exceeds the invoice amount. ' +
      'This usually means the same invoice was allocated more than once or a payment was mis-applied.',
    evidenceTypes: ['invoice', 'payment_allocation'],
    href: '/backend/governance/findings',
  },
  'gov.customer_duplicate_candidates': {
    ruleId: 'gov.customer_duplicate_candidates',
    title: 'Possible duplicate customers',
    severity: 'warning',
    ownerRole: 'crm_ops',
    impactSummary: 'Duplicate customer master data may distort KPI and governance rollups.',
    trigger:
      'When company entities collide on a heuristic grouping key (for example same display name or tax id). ' +
      'It only suggests an identity map — it never auto-merges or deletes the source customers.',
    evidenceTypes: ['company'],
    href: '/backend/governance/identity-maps',
  },
  'gov.deal_stage_probability_conflict': {
    ruleId: 'gov.deal_stage_probability_conflict',
    title: 'Stage / probability mismatch',
    severity: 'info',
    ownerRole: 'sales_rep',
    impactSummary: 'Pipeline forecasting may be inconsistent with stage semantics.',
    trigger:
      'When a deal probability falls outside the expected probability band for its current stage. ' +
      'Each stage has a min–max probability window; a deal outside that window is flagged.',
    evidenceTypes: ['deal'],
    href: '/backend/governance/findings',
  },
  'gov.deal_stale': {
    ruleId: 'gov.deal_stale',
    title: 'Stale deal',
    severity: 'info',
    ownerRole: 'sales_rep',
    impactSummary: 'Pipeline deal may need owner follow-up.',
    trigger:
      'When an open deal has no follow-up activity for 60 days (the STALE_DAYS threshold). ' +
      'Closed or won/lost deals are not evaluated.',
    evidenceTypes: ['deal'],
    href: '/backend/governance/findings',
  },
  'gov.invoice_overdue_outstanding': {
    ruleId: 'gov.invoice_overdue_outstanding',
    title: 'Overdue invoice outstanding',
    severity: 'warning',
    ownerRole: 'finance_ops',
    impactSummary: 'Accounts receivable remains open past the due date.',
    trigger:
      'When an issued invoice has a positive outstanding remainder (issued amount minus allocated amount) ' +
      'and its due date is before the evaluation date (asOf).',
    evidenceTypes: ['invoice'],
    href: '/backend/governance/findings',
  },
  'gov.project_cost_over_budget': {
    ruleId: 'gov.project_cost_over_budget',
    title: 'Project cost over budget',
    severity: 'critical',
    ownerRole: 'finance_ops',
    impactSummary: 'Project actual costs exceed the approved budget.',
    trigger:
      'When the sum of actual project cost rows exceeds the project budget. ' +
      'Only actual (not forecast) cost versions count.',
    evidenceTypes: ['project'],
    href: '/backend/governance/findings',
  },
  'gov.project_milestone_delayed': {
    ruleId: 'gov.project_milestone_delayed',
    title: 'Milestone delayed',
    severity: 'warning',
    ownerRole: 'project_manager',
    impactSummary: 'Delivery milestone is overdue.',
    trigger:
      'When a milestone has a planned date before the evaluation date (asOf), no actual completion date, ' +
      'and its status is not cancelled. This is the same logic used by projects.get_delay_summary.',
    evidenceTypes: ['milestone', 'project'],
    href: '/backend/governance/findings',
  },
  'gov.project_status_conflict': {
    ruleId: 'gov.project_status_conflict',
    title: 'Completed project with open milestones',
    severity: 'warning',
    ownerRole: 'project_manager',
    impactSummary: 'Delivery status and milestone completion disagree.',
    trigger:
      'When a project status is completed but one or more milestones are still planned or in_progress. ' +
      'The project should not be marked complete until its milestones close.',
    evidenceTypes: ['project', 'milestone'],
    href: '/backend/governance/findings',
  },
  'gov.revenue_without_cost': {
    ruleId: 'gov.revenue_without_cost',
    title: 'Revenue without cost',
    severity: 'warning',
    ownerRole: 'finance_ops',
    impactSummary: 'Margin cannot be verified without matching cost facts.',
    trigger:
      'When a project has recognized actual revenue but zero actual cost rows. ' +
      'Gross profit and gross margin are undefined for such projects.',
    evidenceTypes: ['project'],
    href: '/backend/governance/findings',
  },
}

export const RULE_ID_LIST: string[] = Object.keys(RULE_EXPLANATIONS)
