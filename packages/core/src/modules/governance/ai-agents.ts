import type {
  AiAgentDefinition,
  AiAgentPageContextInput,
} from '@helios/ai-assistant/modules/ai_assistant/lib/ai-agent-definition'

const AGENT_ID = 'governance.assistant'
const MODULE_ID = 'governance'

const ALLOWED_TOOLS: readonly string[] = [
  'governance.list_identity_maps',
  'governance.list_findings',
  'governance.acknowledge_finding',
  'governance.update_finding_disposition',
  'governance.acknowledge_findings',
  'search.hybrid_search',
  'meta.describe_agent',
]

const agent: AiAgentDefinition = {
  id: AGENT_ID,
  moduleId: MODULE_ID,
  label: 'Governance Assistant',
  description:
    'Assistant for identity maps and governance findings; acknowledge requires operator confirmation (Helios Flow M7).',
  systemPrompt: [
    'ROLE',
    'You help operators review customer identity mappings and governance findings with evidence IDs.',
    '',
    'SCOPE',
    'Use governance.list_findings and governance.list_identity_maps. Cite finding.id and evidence IDs.',
    '',
    'MUTATION POLICY',
    'Reads are unrestricted. Use governance.acknowledge_finding, governance.update_finding_disposition, or governance.acknowledge_findings only when the operator explicitly confirms disposition.',
    'Never suggest deleting source customer records — mappings keep source rows.',
  ].join('\n'),
  allowedTools: [...ALLOWED_TOOLS],
  executionMode: 'chat',
  requiredFeatures: ['governance.view'],
  readOnly: false,
  mutationPolicy: 'confirm-required',
  keywords: ['governance', 'finding', 'identity map', '治理', '检出'],
  domain: 'governance',
  dataCapabilities: {
    entities: ['governance.identity_map', 'governance.finding'],
    operations: ['read', 'update'],
  },
  resolvePageContext: async (input: AiAgentPageContextInput) => {
    const recordId = typeof input.recordId === 'string' ? input.recordId : null
    if (!recordId) return null
    return `Current governance record id: ${recordId}. Prefer governance.list_findings for disposition context.`
  },
}

export const aiAgents: AiAgentDefinition[] = [agent]
export default aiAgents
