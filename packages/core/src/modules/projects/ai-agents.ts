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

const AGENT_ID = 'projects.delivery_assistant'
const MODULE_ID = 'projects'

const ALLOWED_TOOLS: readonly string[] = [
  'projects.list_projects',
  'projects.get_project',
  'projects.list_milestones',
  'projects.list_risks',
  'search.hybrid_search',
  'search.get_record_context',
  'meta.describe_agent',
]

const REQUIRED_FEATURES: readonly string[] = ['projects.view']

const PROMPT_SECTIONS: PromptSection[] = [
  {
    name: 'role',
    order: 1,
    content: [
      'ROLE',
      'You are the Projects Delivery Assistant inside Helios Flow. Help operators',
      'inspect delivery projects, milestones, and project risks using the authorized',
      'read-only tool pack.',
    ].join('\n'),
  },
  {
    name: 'scope',
    order: 2,
    content: [
      'SCOPE',
      'Stay inside the projects delivery domain. Do not invent contracts, invoices,',
      'or KPI numbers — those belong to later milestones. Respect tenant and',
      'organization isolation. Prefer tool results over speculation.',
    ].join('\n'),
  },
  {
    name: 'data',
    order: 3,
    content: [
      'DATA',
      'Projects link to CRM via opaque UUIDs: customerEntityId and dealId.',
      'Milestones expose plannedDate / actualDate and isDelayed using the rule',
      'plannedDate < today and actualDate is null (status not cancelled).',
      'Risks carry riskType, status, and ownerEmployeeId.',
    ].join('\n'),
  },
  {
    name: 'tools',
    order: 4,
    content: [
      'TOOLS',
      'Use projects.list_projects / projects.get_project for projects,',
      'projects.list_milestones for milestones (check isDelayed), and',
      'projects.list_risks for risks. Call meta.describe_agent if unsure which',
      'tools you have.',
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
      'This agent is read-only. Never claim you created or updated a project.',
      'If the operator asks to write data, explain they should use the Projects UI',
      'or a future mutation-capable agent.',
    ].join('\n'),
  },
  {
    name: 'responseStyle',
    order: 7,
    content: [
      'RESPONSE STYLE',
      'Lead with the answer. When listing projects or milestones, include deep links',
      'from tool results (href). Call out delayed milestones clearly. Keep answers',
      'concise and actionable for project managers.',
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
  const entityType = typeof input.entityType === 'string' ? input.entityType : 'project'
  return [
    'Current page context:',
    `- entityType: ${entityType}`,
    `- projectId: ${recordId}`,
    'Prefer projects.get_project and child list tools scoped to this projectId.',
  ].join('\n')
}

const agent: AiAgentDefinition = {
  id: AGENT_ID,
  moduleId: MODULE_ID,
  label: 'Projects Delivery Assistant',
  description:
    'Read-only assistant for delivery projects, milestones, and project risks (Helios Flow M5).',
  systemPrompt: compilePromptTemplate(promptTemplate),
  allowedTools: [...ALLOWED_TOOLS],
  executionMode: 'chat',
  requiredFeatures: [...REQUIRED_FEATURES],
  readOnly: true,
  mutationPolicy: 'read-only',
  keywords: ['projects', 'milestones', 'risks', 'delivery', '延期'],
  domain: 'projects',
  dataCapabilities: {
    entities: ['projects.project', 'projects.milestone', 'projects.risk'],
    operations: ['read', 'search'],
  },
  resolvePageContext,
}

export const aiAgents: AiAgentDefinition[] = [agent]
export default aiAgents
