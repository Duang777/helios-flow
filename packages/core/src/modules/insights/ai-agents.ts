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
  'customers.list_people',
  'customers.get_person',
  'customers.list_companies',
  'customers.get_company',
  'customers.list_deals',
  'customers.get_deal',
  'customers.analyze_deals',
  'customers.list_activities',
  'customers.list_tasks',
  'customers.update_deal_stage',
  'customers.manage_deal_comment',
  'customers.manage_deal_activity',
  'customers.manage_record_comment',
  'customers.manage_record_activity',
  'sales.list_orders',
  'sales.get_order',
  'sales.list_quotes',
  'sales.get_quote',
  'sales.manage_order',
  'sales.manage_quote',
  'inbox_ops_list_proposals',
  'inbox_ops_get_proposal',
  'inbox_ops_accept_action',
  'catalog.list_products',
  'catalog.get_product',
  'catalog.list_categories',
  'catalog.get_category',
  'catalog.search_products',
  'wms.list_warehouses',
  'wms.list_balances',
  'wms.list_reservations',
  'wms.receive_inventory',
  'wms.adjust_inventory',
  'wms.move_inventory',
  'workflows.list_instances',
  'workflows.get_instance',
  'workflows.list_tasks',
  'workflows.get_task',
  'workflows.claim_task',
  'workflows.complete_task',
  'workflows.start_instance',
  'workflows.cancel_instance',
  'workflows.retry_instance',
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
  'governance.update_findings_disposition',
  'governance.acknowledge_findings',
  'projects.manage_milestone',
  'projects.manage_risk',
  'messages.list_messages',
  'messages.get_message',
  'messages.send_message',
  'messages.reply_to_message',
  'staff.list_team_members',
  'staff.list_leave_requests',
  'staff.accept_leave_request',
  'staff.reject_leave_request',
  'integrations.list_integrations',
  'integrations.get_integration',
  'search.hybrid_search',
  'search.get_record_context',
  'attachments.list_record_attachments',
  'attachments.read_attachment',
  'meta.describe_agent',
]

type OperatingLoopResolvedPageContextInput = AiAgentPageContextInput & {
  tableId?: unknown
  searchValue?: unknown
  visibleFilters?: unknown
  page?: unknown
  pageSize?: unknown
  totalMatching?: unknown
  selectedRecordIds?: unknown
  extra?: unknown
}

function readContextString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readContextNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function formatContextRecord(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const json = JSON.stringify(value)
  return json === '{}' ? null : json
}

function formatContextStringList(value: unknown): string | null {
  if (!Array.isArray(value)) return null
  const list = value.filter((item): item is string => typeof item === 'string' && item.length > 0)
  return list.length > 0 ? list.join(', ') : null
}

function resolvePageContextField(entityType: string | null): string {
  switch (entityType) {
    case 'customers.customer_entity':
    case 'customers.company':
      return 'customerEntityId'
    case 'customers.person':
      return 'personId'
    case 'customers.deal':
      return 'dealId'
    case 'sales.order':
      return 'orderId'
    case 'sales.quote':
      return 'quoteId'
    case 'catalog.product':
      return 'productId'
    case 'wms.warehouse':
      return 'warehouseId'
    case 'wms.inventory_balance':
      return 'balanceId'
    case 'wms.inventory_reservation':
      return 'reservationId'
    case 'workflows.instance':
      return 'instanceId'
    case 'workflows.task':
      return 'taskId'
    case 'integrations.integration':
      return 'integrationId'
    case 'inbox_ops.proposal':
      return 'proposalId'
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
    case 'insights.kpi_completion':
      return 'kpiCompletionId'
    case 'insights.operating_loop_digest':
      return 'digestId'
    case 'governance.finding':
      return 'findingId'
    case 'governance.identity_map':
      return 'identityMapId'
    case 'messages.message':
      return 'messageId'
    case 'staff.leave_request':
      return 'leaveRequestId'
    case 'staff.team_member':
      return 'teamMemberId'
    default:
      return 'recordId'
  }
}

const agent: AiAgentDefinition = {
  id: AGENT_ID,
  moduleId: MODULE_ID,
  label: 'Insights KPI Assistant',
  labelKey: 'insights.ai_agents.kpi_assistant.label',
  description: 'Read-only assistant for KPI targets and completion analytics (Helios Flow M7).',
  descriptionKey: 'insights.ai_agents.kpi_assistant.description',
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
  labelKey: 'insights.ai_agents.operating_loop_assistant.label',
  description:
    'Cross-module operating advisor for CRM, sales, inbox, catalog, warehouse, workflows, projects, settlement, KPI gaps, governance, and integration health.',
  descriptionKey: 'insights.ai_agents.operating_loop_assistant.description',
  systemPrompt: [
    'ROLE',
    'You are the Operating Loop Assistant for Helios. You act like an operating advisor across CRM, sales documents, inbox proposals, internal messages, catalog, warehouse stock, workflow tasks, staff roster context, delivery projects, commercial settlement, KPI completion, governance findings, and integration health.',
    '',
    'SCOPE',
    'Stay inside the enabled Helios modules and their tool results. Do not pretend to be general ledger, do not write master data outside the explicit confirmed mutation tools, and never delete source customer records. Respect tenant and organization isolation. If a tool is missing because the caller lacks the feature, skip that hop and say so. Never request, print, or guess integration credentials.',
    '',
    'ORCHESTRATION',
    'Follow the closed loop when the user asks a business question: customer/deal -> sales quote/order -> inbox proposal / internal messages -> catalog / warehouse stock -> workflow tasks -> staff ownership context -> project status, delays, and risks -> contract/invoice/payment facts -> KPI gap -> governance findings -> integration health. Chain multiple tools in one turn when the question spans hops. Ask the next useful follow-up only after showing the current answer. When page context includes current entity ids, treat them as authoritative and reuse them in every downstream tool call.',
    '',
    'TOOLS',
    'Use customers.* for people, companies, and deals; sales.* for quotes and orders; inbox_ops_* for inbound email proposals; messages.* for internal messages (including confirm-required send/reply, never email); catalog.* for products and categories; wms.* for warehouses and inventory (including confirm-required receive/adjust/move); workflows.* for instances and user tasks (including confirm-required start/cancel/retry); staff.* for team members and leave (including confirm-required accept/reject); projects.* for delivery state and risk writes; commercial.* for settlement facts and overdue AR; insights.get_kpi_gap for target gaps and dragged organizations; governance.* for findings and confirmed disposition writes; and integrations.* for connector health without secrets.',
    '',
    'PROMPT ROUTING RULES',
    'If the user asks about a customer, company, person, deal, 客户, 公司, or 商机, call the matching customers.list_* / customers.get_* tool first. For stalled or risky deals, call customers.analyze_deals before suggesting customers.update_deal_stage.',
    'If the user asks about an order, quote, 订单, or 报价, call sales.list_orders / sales.get_order or sales.list_quotes / sales.get_quote and cite document ids, customerEntityId, totals, and href. Status changes go through sales.manage_order or sales.manage_quote with statusEntryId from the current dictionary, never a free-typed status slug.',
    'If the user asks about inbox mail, 收件箱, or 邮件提案, call inbox_ops_list_proposals or inbox_ops_get_proposal. To accept a pending proposal action, call inbox_ops_accept_action and wait for the approval card. Do not categorize emails from this agent.',
    'If the user asks about internal messages, 站内消息, or 消息收件箱, call messages.list_messages or messages.get_message. Send/reply with messages.send_message / messages.reply_to_message and wait for the confirmation card. Never enable email delivery from this agent.',
    'If the user asks about a product, SKU, category, 商品, or 目录, call catalog.search_products or catalog.get_product before answering.',
    'If the user asks about stock, warehouse, 库存, or 仓库, call wms.list_balances or wms.list_reservations first. Receive/adjust/move must use wms.receive_inventory / wms.adjust_inventory / wms.move_inventory and wait for the confirmation card — never claim inventory already changed.',
    'If the user asks about a workflow, 工作流, 待办任务, or task inbox, call workflows.list_tasks or workflows.get_instance. Read formSchema via workflows.get_task before workflows.complete_task. Start/cancel/retry instances via workflows.start_instance / workflows.cancel_instance / workflows.retry_instance with confirmation only.',
    'If the user asks about employees, 员工, 团队成员, or leave, 请假, call staff.list_team_members or staff.list_leave_requests. Approve/reject with staff.accept_leave_request / staff.reject_leave_request and wait for the confirmation card.',
    'If the user asks about an integration, connector, 集成, or 连接器, call integrations.list_integrations. Report health and enablement only.',
    'If the user asks about overdue AR, overdue receivables, 逾期应收, 逾期回款, or 逾期未回金额, call commercial.list_overdue_invoices and commercial.explain_metric before answering. Treat returned invoice ids, payment ids, and allocation ids as evidence IDs and label them explicitly.',
    'If the user asks about critical findings, governance risks, 治理检出, or 处置建议, call governance.list_findings, governance.explain_rule, and governance.suggest_disposition before answering. Cite finding.id, ruleId, severity, ownerRole, evidence IDs, and href. Today digest critical counts match open+critical findings (not exact asOf-only).',
    'If the user asks whether a project is delayed or what is risky on the current project page, call projects.get_delay_summary and projects.list_risks first, then continue with commercial.get_project_settlement_summary, insights.get_kpi_gap, and governance.list_findings when the question asks for money, KPI, or findings. Risk status changes go through projects.manage_risk with confirmation. If there are no risks and the user asks to create an example risk or set mitigating, still call projects.manage_risk (create or update) so the confirm card appears.',
    'For cross-hop questions (客户+订单+延期+回款+KPI+治理), call customers.list_deals (or list_companies), sales.list_orders, projects.get_delay_summary, commercial.get_project_settlement_summary, insights.get_kpi_gap, and governance.list_findings in one turn and synthesize one answer with numbers, formula sources, evidence IDs, and hrefs.',
    '',
    'MUTATION POLICY',
    'Read tools freely. Deal stage, activity/comment, sales document updates, inbox proposal accept, internal message send/reply, WMS receive/adjust/move, workflow claim/complete/start/cancel/retry, staff leave accept/reject, project/milestone/risk, contract, invoice, payment, allocation, KPI-target, and governance disposition writes all require confirmation. Do not claim you updated data until the approval card is confirmed.',
    '',
    'SUGGEST TOOLS',
    'After calling any *suggest_* tool (commercial.suggest_collection_actions, governance.suggest_disposition, projects.suggest_delay_mitigation, insights.suggest_kpi_actions), inspect the response\'s `linkedMutations` array — each entry is the concrete write tool that can persist the proposal item. Chain into the appropriate write tool with the `argsTemplate` substituted from each proposal item. The mutation itself goes through the standard pending-actions confirm gate, so do not skip this step.',
    '',
    'RESPONSE STYLE',
    'Every business answer must include the number, the formula source or source table, and at least one href when tool results provide links. Prefer hrefs that start with `/backend/`.',
    'Never paste bare paths like `/backend/commercial/contracts/<id>` as the only link text. Always use Markdown links with a human-readable Chinese (or English) label from the tool result (name, code, document number, title), for example `[大众-产线B项目合同](/backend/commercial/contracts/<id>)`, `[INV-00005](/backend/commercial/invoices/<id>)`, `[大众-产线B项目交付](/backend/projects/<id>)`. If no name is available, use a short typed label such as `合同详情` / `发票详情` / `项目详情`, never the raw path alone.',
    'Always include a bullet that starts with `证据:` or `Evidence:` and lists the relevant finding.id, evidence IDs, invoice ids, project ids, contract ids, plus the same Markdown links. For findings, cite finding.id and evidence IDs. Use concise bullet points for multi-step answers and label assumptions explicitly.',
  ].join('\n'),
  allowedTools: [...OPERATING_LOOP_ALLOWED_TOOLS],
  taskPlan: { enabled: true },
  executionMode: 'chat',
  requiredFeatures: ['projects.view', 'commercial.view', 'insights.view', 'governance.view'],
  readOnly: false,
  mutationPolicy: 'confirm-required',
  keywords: [
    'operating loop',
    'customers',
    'sales',
    'inbox',
    'catalog',
    'wms',
    'workflows',
    'projects',
    'commercial',
    'kpi',
    'governance',
    'integrations',
    '经营参谋',
    '闭环',
  ],
  domain: 'insights',
  dataCapabilities: {
    entities: [
      'customers.person',
      'customers.company',
      'customers.deal',
      'sales.order',
      'sales.quote',
      'inbox_ops.proposal',
      'catalog.product',
      'wms.warehouse',
      'workflows.task',
      'projects.project',
      'projects.milestone',
      'commercial.contract',
      'commercial.invoice',
      'commercial.payment',
      'insights.kpi_target',
      'governance.finding',
      'integrations.integration',
    ],
    operations: ['read', 'search', 'aggregate'],
  },
  resolvePageContext: async (input: AiAgentPageContextInput) => {
    const pageContext = input as OperatingLoopResolvedPageContextInput
    const recordId = typeof input.recordId === 'string' ? input.recordId : null
    const entityType = typeof input.entityType === 'string' ? input.entityType : null
    const tableId = readContextString(pageContext.tableId)
    if (!recordId && !entityType && !input.organizationId && !tableId) return null
    const visibleFilters = formatContextRecord(pageContext.visibleFilters)
    const extra = formatContextRecord(pageContext.extra)
    const selectedRecordIds = formatContextStringList(pageContext.selectedRecordIds)
    const page = readContextNumber(pageContext.page)
    const pageSize = readContextNumber(pageContext.pageSize)
    const totalMatching = readContextNumber(pageContext.totalMatching)
    return [
      'Current page context:',
      input.organizationId ? `- organizationId: ${input.organizationId}` : null,
      entityType ? `- entityType: ${entityType}` : null,
      tableId ? `- tableId: ${tableId}` : null,
      recordId ? `- ${resolvePageContextField(entityType)}: ${recordId}` : null,
      visibleFilters ? `- visibleFilters: ${visibleFilters}` : null,
      extra ? `- scopedIds: ${extra}` : null,
      selectedRecordIds ? `- selectedRecordIds: ${selectedRecordIds}` : null,
      totalMatching !== null ? `- totalMatching: ${totalMatching}` : null,
      page !== null && pageSize !== null ? `- page: ${page}, pageSize: ${pageSize}` : null,
      'Prefer the matching scoped tool first, then continue the operating loop if the user asks why, how much, or what to do next.',
    ]
      .filter((line): line is string => typeof line === 'string')
      .join('\n')
  },
}

export const aiAgents: AiAgentDefinition[] = [agent, operatingLoopAgent]
export default aiAgents
