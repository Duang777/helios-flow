import { z } from 'zod'
import { defineApiBackedAiTool } from '@helios/ai-assistant/modules/ai_assistant/lib/api-backed-tool'
import type { AiApiOperationRequest } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import {
  assertTenantScope,
  type IntegrationsAiToolDefinition,
  type IntegrationsToolContext,
} from './types'

const SAFE_INTEGRATION_FIELDS = [
  'id',
  'title',
  'category',
  'tags',
  'isEnabled',
  'hasCredentials',
  'healthStatus',
  'lastHealthCheckedAt',
  'lastHealthLatencyMs',
  'enabledAt',
] as const

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function projectIntegration(row: Record<string, unknown>): Record<string, unknown> {
  const id = typeof row.id === 'string' ? row.id : null
  const projected: Record<string, unknown> = {}
  for (const field of SAFE_INTEGRATION_FIELDS) {
    projected[field] = row[field] ?? null
  }
  projected.href = id ? `/backend/integrations/${id}` : null
  return projected
}

const listIntegrationsTool = defineApiBackedAiTool({
  name: 'integrations.list_integrations',
  displayName: 'List integrations',
  description:
    'List installed integrations with enablement and health status. Never returns credentials or secret values.',
  inputSchema: z.object({
    q: z.string().trim().optional(),
    category: z.string().optional(),
    isEnabled: z.boolean().optional(),
    healthStatus: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  requiredFeatures: ['integrations.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as IntegrationsToolContext)
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/integrations',
      query: {
        q: input.q,
        category: input.category,
        isEnabled: input.isEnabled === undefined ? undefined : input.isEnabled ? 'true' : 'false',
        healthStatus: input.healthStatus,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      },
    }
    return operation
  },
  mapResponse: (response, input) => {
    const payload = asRecord(response.data) ?? {}
    const items = Array.isArray(payload.items) ? payload.items : []
    return {
      items: items
        .map((row) => asRecord(row))
        .filter((row): row is Record<string, unknown> => row !== null)
        .map(projectIntegration),
      total: typeof payload.total === 'number' ? payload.total : items.length,
      limit: input.limit ?? 50,
      offset: input.offset ?? 0,
    }
  },
}) as unknown as IntegrationsAiToolDefinition

const getIntegrationTool = defineApiBackedAiTool({
  name: 'integrations.get_integration',
  displayName: 'Get integration',
  description:
    'Fetch one integration by id with health and enablement. Never returns credentials, tokens, or secret values.',
  inputSchema: z.object({ integrationId: z.string().min(1) }),
  requiredFeatures: ['integrations.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as IntegrationsToolContext)
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: `/integrations/${input.integrationId}`,
    }
    return operation
  },
  mapResponse: (response) => {
    const payload = asRecord(response.data) ?? {}
    const integration = asRecord(payload.integration) ?? payload
    const state = asRecord(payload.state)
    if (!integration) return null
    const id = typeof integration.id === 'string' ? integration.id : null
    if (!id) return null
    return projectIntegration({
      ...integration,
      isEnabled: state?.isEnabled ?? payload.isEnabled ?? integration.isEnabled,
      hasCredentials: payload.hasCredentials,
      healthStatus: payload.healthStatus,
      lastHealthCheckedAt: state?.lastHealthCheckedAt ?? payload.lastHealthCheckedAt,
      lastHealthLatencyMs: state?.lastHealthLatencyMs ?? payload.lastHealthLatencyMs,
      enabledAt: state?.enabledAt ?? payload.enabledAt,
    })
  },
}) as unknown as IntegrationsAiToolDefinition

export const integrationsAiTools: IntegrationsAiToolDefinition[] = [listIntegrationsTool, getIntegrationTool]

export default integrationsAiTools
