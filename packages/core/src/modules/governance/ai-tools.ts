import { z } from 'zod'
import { defineApiBackedAiTool } from '@helios/ai-assistant/modules/ai_assistant/lib/api-backed-tool'
import type { AiApiOperationRequest } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'

export type GovernanceToolContext = {
  tenantId?: string
  organizationId?: string
}

export type GovernanceAiToolDefinition = ReturnType<typeof defineApiBackedAiTool>

function assertTenantScope(ctx: GovernanceToolContext): void {
  if (!ctx.tenantId || !ctx.organizationId) {
    throw new Error('[internal] governance AI tools require tenant and organization scope')
  }
}

const listIdentityMapsInput = z
  .object({
    status: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .passthrough()

const listIdentityMapsTool = defineApiBackedAiTool({
  name: 'governance.list_identity_maps',
  displayName: 'List identity maps',
  description: 'List customer identity dedupe mappings (source rows kept).',
  inputSchema: listIdentityMapsInput,
  requiredFeatures: ['governance.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as GovernanceToolContext)
    const query: Record<string, string | number> = {
      page: 1,
      pageSize: input.limit ?? 50,
    }
    if (input.status) query.status = input.status
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/governance/identity-maps',
      query,
    }
    return operation
  },
  mapResponse: (response) => {
    const data = (response.data ?? {}) as { items?: Array<Record<string, unknown>>; total?: number }
    return {
      items: Array.isArray(data.items) ? data.items : [],
      total: typeof data.total === 'number' ? data.total : 0,
    }
  },
}) as unknown as GovernanceAiToolDefinition

const listFindingsInput = z
  .object({
    status: z.string().optional(),
    ruleId: z.string().optional(),
    severity: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .passthrough()

const listFindingsTool = defineApiBackedAiTool({
  name: 'governance.list_findings',
  displayName: 'List governance findings',
  description: 'List structured governance findings with evidence IDs for disposition advice.',
  inputSchema: listFindingsInput,
  requiredFeatures: ['governance.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as GovernanceToolContext)
    const query: Record<string, string | number> = {
      page: 1,
      pageSize: input.limit ?? 50,
    }
    if (input.status) query.status = input.status
    if (input.ruleId) query.ruleId = input.ruleId
    if (input.severity) query.severity = input.severity
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/governance/findings',
      query,
    }
    return operation
  },
  mapResponse: (response) => {
    const data = (response.data ?? {}) as { items?: Array<Record<string, unknown>>; total?: number }
    return {
      items: Array.isArray(data.items) ? data.items : [],
      total: typeof data.total === 'number' ? data.total : 0,
    }
  },
}) as unknown as GovernanceAiToolDefinition

const acknowledgeFindingInput = z.object({
  findingId: z.string().uuid(),
})

const acknowledgeFindingTool = defineApiBackedAiTool({
  name: 'governance.acknowledge_finding',
  displayName: 'Acknowledge finding',
  description: 'Mark a governance finding as acknowledged (requires operator confirmation).',
  inputSchema: acknowledgeFindingInput,
  requiredFeatures: ['governance.manage'],
  isMutation: true,
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as GovernanceToolContext)
    const operation: AiApiOperationRequest = {
      method: 'PUT',
      path: '/governance/findings',
      body: {
        id: input.findingId,
        organizationId: (ctx as GovernanceToolContext).organizationId,
        tenantId: (ctx as GovernanceToolContext).tenantId,
        status: 'acknowledged',
      },
    }
    return operation
  },
  mapResponse: () => ({ ok: true }),
}) as unknown as GovernanceAiToolDefinition

export const aiTools: GovernanceAiToolDefinition[] = [
  listIdentityMapsTool,
  listFindingsTool,
  acknowledgeFindingTool,
]

export default aiTools
