import type { z } from 'zod'
import type { AwilixContainer } from 'awilix'

export interface ProjectsToolContext {
  tenantId: string | null
  organizationId: string | null
  userId: string | null
  container: AwilixContainer
  userFeatures: string[]
  isSuperAdmin: boolean
  apiKeySecret?: string
  sessionId?: string
}

export interface ProjectsAiToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string
  displayName?: string
  description: string
  inputSchema: z.ZodType<TInput>
  requiredFeatures?: string[]
  isMutation?: boolean
  handler?: (input: TInput, ctx: ProjectsToolContext) => Promise<TOutput> | TOutput
  toOperation?: unknown
  mapResponse?: unknown
}

export function assertTenantScope(ctx: ProjectsToolContext): {
  tenantId: string
  organizationId: string | null
} {
  if (!ctx.tenantId) {
    throw new Error('[internal] Tenant context is required for projects.* tools')
  }
  return { tenantId: ctx.tenantId, organizationId: ctx.organizationId ?? null }
}
