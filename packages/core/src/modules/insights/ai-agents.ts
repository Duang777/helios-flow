import type {
  AiAgentDefinition,
  AiAgentPageContextInput,
} from '@helios/ai-assistant/modules/ai_assistant/lib/ai-agent-definition'

const AGENT_ID = 'insights.kpi_assistant'
const OPERATING_LOOP_AGENT_ID = 'insights.operating_loop_assistant'
const MODULE_ID = 'insights'

const ALLOWED_TOOLS: readonly string[] = [
  'insights.list_kpi_targets',
  'insights.get_kpi_completion',
  'commercial.get_metrics',
  'search.hybrid_search',
  'meta.describe_agent',
]

const OPERATING_LOOP_ALLOWED_TOOLS: readonly string[] = [
  'projects.list_projects',
  'projects.get_project',
  'projects.manage_project',
  'projects.list_milestones',
  'projects.get_delay_summary',
  'projects.explain_delay_rule',
  'projects.suggest_delay_mitigation',
  'projects.list_risks',
  'commercial.list_contracts',
  'commercial.get_contract',
  'commercial.manage_contract',
  'commercial.list_invoices',
  'commercial.list_overdue_invoices',
  'commercial.manage_invoice',
  'commercial.list_payments',
  'commercial.manage_payment',
  'commercial.list_payment_allocations',
  'commercial.manage_allocation',
  'commercial.get_metrics',
  'commercial.explain_metric',
  'commercial.suggest_collection_actions',
  'commercial.get_project_settlement_summary',
  'insights.list_kpi_targets',
  'insights.get_kpi_completion',
  'insights.get_kpi_gap',
  'insights.explain_kpi_metric',
  'insights.suggest_kpi_actions',
  'insights.manage_kpi_target',
  'governance.list_identity_maps',
  'governance.list_findings',
  'governance.explain_rule',
  'governance.suggest_disposition',
  'governance.acknowledge_finding',
  'governance.update_finding_disposition',
  'governance.acknowledge_findings',
  'search.hybrid_search',
  'search.get_record_context',
  'meta.describe_agent',
]

function resolvePageContextField(entityType: string | null): string {
  switch (entityType) {
    case 'customers.customer_entity':
    case 'customers.company':
      return 'customerEntityId'
    case 'customers.deal':
      return 'dealId'
    case 'projects.project':
      return 'projectId'
    case 'projects.milestone':
      return 'milestoneId'
    case 'projects.risk':
      return 'riskId'
    case 'commercial.contract':
      return 'contractId'
    case 'commercial.invoice':
      return 'invoiceId'
    case 'commercial.payment':
      return 'paymentId'
    case 'commercial.payment_allocation':
      return 'allocationId'
    case 'insights.kpi_target':
      return 'kpiTargetId'
    case 'governance.finding':
      return 'findingId'
    case 'governance.identity_map':
      return 'identityMapId'
    default:
      return 'recordId'
  }
}

const agent: AiAgentDefinition = {
  id: AGENT_ID,
  moduleId: MODULE_ID,
  label: 'Insights KPI Assistant',
  description: 'Read-only assistant for KPI targets and completion analytics (Helios Flow M7).',
  systemPrompt: [
    'ROLE',
    'You explain KPI completion rates and metric definitions for regional operating targets.',
    '',
    'SCOPE',
    'Use insights.get_kpi_completion and commercial.get_metrics for actuals. Actuals come from',
    'commercial settlement facts — never invent overrides.',
    '',
    'MUTATION POLICY',
    'Read-only. Direct users to Insights admin UI for target changes.',
  ].join('\n'),
  allowedTools: [...ALLOWED_TOOLS],
  executionMode: 'chat',
  requiredFeatures: ['insights.view'],
  readOnly: true,
  mutationPolicy: 'read-only',
  keywords: ['insights', 'kpi', 'completion', 'target', '经营分析'],
  domain: 'insights',
  dataCapabilities: {
    entities: ['insights.kpi_target'],
    operations: ['read'],
  },
  resolvePageContext: async (input: AiAgentPageContextInput) => {
    const recordId = typeof input.recordId === 'string' ? input.recordId : null
    if (!recordId) return null
    return `Current KPI target id: ${recordId}. Prefer insights.get_kpi_completion for board context.`
  },
}

const operatingLoopAgent: AiAgentDefinition = {
  id: OPERATING_LOOP_AGENT_ID,
  moduleId: MODULE_ID,
  label: 'Operating Loop Assistant',
  description:
    'Cross-module operating advisor for projects, settlement, KPI gaps, and governance findings.',
  systemPrompt: [
    'ROLE',
    'You are the Operating Loop Assistant for Helios Flow. You act like an operating advisor across delivery projects, commercial settlement, KPI completion, and governance findings.',
    '',
    'SCOPE',
    'Stay inside the enabled Helios modules and their tool results. Do not pretend to be general ledger, do not write master data outside the explicit confirmed mutation tools, and never delete source customer records. Respect tenant and organization isolation.',
    '',
    'ORCHESTRATION',
    'Follow the closed loop when the user asks a business question: project status and delays -> contract/invoice/payment facts -> KPI gap -> governance findings. Ask the next useful follow-up only after showing the current answer. When page context includes current entity ids, treat them as authoritative and reuse them in every downstream tool call.',
    '',
    'TOOLS',
    'Use projects.* for delivery state, commercial.* for settlement facts and overdue AR, insights.get_kpi_gap for target gaps and dragged organizations, and governance.* for findings and confirmed disposition writes.',
    '',
    'MUTATION POLICY',
    'Read tools freely. Project, contract, invoice, payment, allocation, KPI-target, and governance disposition writes all require confirmation. Do not claim you updated data until the approval card is confirmed.',
    '',
    'RESPONSE STYLE',
    'Every business answer must include the number, the formula source or source table, and at least one href when tool results provide links. For findings, cite finding.id and evidence IDs. Use concise bullet points for multi-step answers and label assumptions explicitly.',
  ].join('\n'),
  allowedTools: [...OPERATING_LOOP_ALLOWED_TOOLS],
  taskPlan: { enabled: true },
  executionMode: 'chat',
  requiredFeatures: ['projects.view', 'commercial.view', 'insights.view', 'governance.view'],
  readOnly: false,
  mutationPolicy: 'confirm-required',
  keywords: ['operating loop', 'projects', 'commercial', 'kpi', 'governance', '经营参谋', '闭环'],
  domain: 'insights',
  dataCapabilities: {
    entities: [
      'projects.project',
      'projects.milestone',
      'commercial.contract',
      'commercial.invoice',
      'commercial.payment',
      'insights.kpi_target',
      'governance.finding',
    ],
    operations: ['read', 'search', 'aggregate'],
  },
  resolvePageContext: async (input: AiAgentPageContextInput) => {
    const recordId = typeof input.recordId === 'string' ? input.recordId : null
    const entityType = typeof input.entityType === 'string' ? input.entityType : null
    if (!recordId && !entityType && !input.organizationId) return null
    return [
      'Current page context:',
      input.organizationId ? `- organizationId: ${input.organizationId}` : null,
      entityType ? `- entityType: ${entityType}` : null,
      recordId ? `- ${resolvePageContextField(entityType)}: ${recordId}` : null,
      'Prefer the matching scoped tool first, then continue the operating loop if the user asks why, how much, or what to do next.',
    ]
      .filter((line): line is string => typeof line === 'string')
      .join('\n')
  },
}

export const aiAgents: AiAgentDefinition[] = [agent, operatingLoopAgent]
export default aiAgents
