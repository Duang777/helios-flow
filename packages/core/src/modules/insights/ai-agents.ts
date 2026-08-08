import type {
  AiAgentDefinition,
  AiAgentPageContextInput,
} from '@helios/ai-assistant/modules/ai_assistant/lib/ai-agent-definition'

const AGENT_ID = 'insights.kpi_assistant'
const MODULE_ID = 'insights'

const ALLOWED_TOOLS: readonly string[] = [
  'insights.list_kpi_targets',
  'insights.get_kpi_completion',
  'commercial.get_metrics',
  'search.hybrid_search',
  'meta.describe_agent',
]

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

export const aiAgents: AiAgentDefinition[] = [agent]
export default aiAgents
