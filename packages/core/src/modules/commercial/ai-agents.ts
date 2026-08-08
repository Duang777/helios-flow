import type {
  AiAgentDefinition,
  AiAgentPageContextInput,
} from '@helios/ai-assistant/modules/ai_assistant/lib/ai-agent-definition'

type PromptSectionName =
  | 'role'
  | 'scope'
  | 'data'
  | 'tools'
  | 'attachments'
  | 'mutationPolicy'
  | 'responseStyle'

interface PromptSection {
  name: PromptSectionName
  content: string
  order?: number
}

interface PromptTemplate {
  id: string
  sections: PromptSection[]
}

const AGENT_ID = 'commercial.settlement_assistant'
const MODULE_ID = 'commercial'

const ALLOWED_TOOLS: readonly string[] = [
  'commercial.list_contracts',
  'commercial.get_contract',
  'commercial.get_metrics',
  'search.hybrid_search',
  'search.get_record_context',
  'meta.describe_agent',
]

const REQUIRED_FEATURES: readonly string[] = ['commercial.view']

const PROMPT_SECTIONS: PromptSection[] = [
  {
    name: 'role',
    order: 1,
    content: [
      'ROLE',
      'You are the Commercial Settlement Assistant inside Helios Flow. Help operators',
      'inspect contracts, invoices, payments, and operating metrics using read-only tools.',
    ].join('\n'),
  },
  {
    name: 'scope',
    order: 2,
    content: [
      'SCOPE',
      'This is operating settlement — NOT general ledger. Never promise vouchers,',
      'chart of accounts, or GL postings. Respect tenant and organization isolation.',
    ].join('\n'),
  },
  {
    name: 'data',
    order: 3,
    content: [
      'DATA',
      'Collection rate uses Σ allocated_amount ÷ Σ invoice_amount — never raw payment totals.',
      'Metrics tool responses include definitions with formulas and source tables.',
    ].join('\n'),
  },
  {
    name: 'tools',
    order: 4,
    content: [
      'TOOLS',
      'Use commercial.list_contracts / commercial.get_contract for contracts and',
      'commercial.get_metrics for KPIs. Call meta.describe_agent when unsure.',
    ].join('\n'),
  },
  {
    name: 'attachments',
    order: 5,
    content: ['ATTACHMENTS', 'No attachment tools are required for this agent.'].join('\n'),
  },
  {
    name: 'mutationPolicy',
    order: 6,
    content: [
      'MUTATION POLICY',
      'Read-only agent. Direct users to the Commercial Settlement UI for writes.',
    ].join('\n'),
  },
  {
    name: 'responseStyle',
    order: 7,
    content: [
      'RESPONSE STYLE',
      'Lead with the answer. Cite metric definitions when explaining rates or overdue balances.',
    ].join('\n'),
  },
]

export const promptTemplate: PromptTemplate = {
  id: `${AGENT_ID}.prompt`,
  sections: PROMPT_SECTIONS,
}

function compilePromptTemplate(template: PromptTemplate): string {
  return template.sections
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((section) => section.content.trim())
    .join('\n\n')
}

async function resolvePageContext(input: AiAgentPageContextInput): Promise<string | null> {
  const recordId = typeof input.recordId === 'string' ? input.recordId : null
  if (!recordId) return null
  const entityType = typeof input.entityType === 'string' ? input.entityType : 'contract'
  return [
    'Current page context:',
    `- entityType: ${entityType}`,
    `- recordId: ${recordId}`,
    'Prefer commercial.get_contract or scoped metrics when relevant.',
  ].join('\n')
}

const agent: AiAgentDefinition = {
  id: AGENT_ID,
  moduleId: MODULE_ID,
  label: 'Commercial Settlement Assistant',
  description: 'Read-only assistant for contracts and operating metrics (Helios Flow M6).',
  systemPrompt: compilePromptTemplate(promptTemplate),
  allowedTools: [...ALLOWED_TOOLS],
  executionMode: 'chat',
  requiredFeatures: [...REQUIRED_FEATURES],
  readOnly: true,
  mutationPolicy: 'read-only',
  keywords: ['commercial', 'contract', 'invoice', 'payment', '开票', '回款'],
  domain: 'commercial',
  dataCapabilities: {
    entities: ['commercial.contract', 'commercial.invoice', 'commercial.payment'],
    operations: ['read', 'search'],
  },
  resolvePageContext,
}

export const aiAgents: AiAgentDefinition[] = [agent]
export default aiAgents
