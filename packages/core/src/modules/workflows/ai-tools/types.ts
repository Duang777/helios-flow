import type { z } from 'zod'
import type { AwilixContainer } from 'awilix'

export interface WorkflowsToolContext {
  tenantId: string | null
  organizationId: string | null
  userId: string | null
  container: AwilixContainer
  userFeatures: string[]
  isSuperAdmin: boolean
  apiKeySecret?: string
  sessionId?: string
}

export interface WorkflowsAiToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string
  displayName?: string
  description: string
  inputSchema: z.ZodType<TInput>
  requiredFeatures?: string[]
  isMutation?: boolean
  handler?: (input: TInput, ctx: WorkflowsToolContext) => Promise<TOutput> | TOutput
  toOperation?: unknown
  mapResponse?: unknown
  loadBeforeRecord?: unknown
}

export function assertTenantScope(ctx: WorkflowsToolContext): {
  tenantId: string
  organizationId: string | null
} {
  if (!ctx.tenantId) {
    throw new Error('[internal] Tenant context is required for workflows.* tools')
  }
  return { tenantId: ctx.tenantId, organizationId: ctx.organizationId ?? null }
}
