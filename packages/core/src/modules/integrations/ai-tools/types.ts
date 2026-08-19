import type { z } from 'zod'
import type { AwilixContainer } from 'awilix'

export interface IntegrationsToolContext {
  tenantId: string | null
  organizationId: string | null
  userId: string | null
  container: AwilixContainer
  userFeatures: string[]
  isSuperAdmin: boolean
  apiKeySecret?: string
  sessionId?: string
}

export interface IntegrationsAiToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string
  displayName?: string
  description: string
  inputSchema: z.ZodType<TInput>
  requiredFeatures?: string[]
  isMutation?: boolean
  handler?: (input: TInput, ctx: IntegrationsToolContext) => Promise<TOutput> | TOutput
  toOperation?: unknown
  mapResponse?: unknown
}

export function assertTenantScope(ctx: IntegrationsToolContext): {
  tenantId: string
  organizationId: string | null
} {
  if (!ctx.tenantId) {
    throw new Error('[internal] Tenant context is required for integrations.* tools')
  }
  return { tenantId: ctx.tenantId, organizationId: ctx.organizationId ?? null }
}
