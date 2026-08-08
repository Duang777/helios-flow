import { z } from 'zod'
import { defineApiBackedAiTool } from '@helios/ai-assistant/modules/ai_assistant/lib/api-backed-tool'
import type { AiApiOperationRequest } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'

export type InsightsToolContext = {
  tenantId?: string
  organizationId?: string
}

export type InsightsAiToolDefinition = ReturnType<typeof defineApiBackedAiTool>

function assertTenantScope(ctx: InsightsToolContext): void {
  if (!ctx.tenantId || !ctx.organizationId) {
    throw new Error('[internal] insights AI tools require tenant and organization scope')
  }
}

const listKpiTargetsInput = z
  .object({
    metricKey: z.string().optional(),
    periodType: z.string().optional(),
    periodKey: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .passthrough()

const listKpiTargetsTool = defineApiBackedAiTool({
  name: 'insights.list_kpi_targets',
  displayName: 'List KPI targets',
  description: 'List KPI targets for the caller tenant and organization.',
  inputSchema: listKpiTargetsInput,
  requiredFeatures: ['insights.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as InsightsToolContext)
    const query: Record<string, string | number> = {
      page: 1,
      pageSize: input.limit ?? 50,
    }
    if (input.metricKey) query.metricKey = input.metricKey
    if (input.periodType) query.periodType = input.periodType
    if (input.periodKey) query.periodKey = input.periodKey
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/insights/kpi-targets',
      query,
    }
    return operation
  },
  mapResponse: (response) => {
    const data = (response.data ?? {}) as { items?: Array<Record<string, unknown>>; total?: number }
    const items = Array.isArray(data.items) ? data.items : []
    return {
      items: items.map((row) => ({
        id: row.id,
        metricKey: row.metricKey ?? null,
        periodType: row.periodType ?? null,
        periodKey: row.periodKey ?? null,
        targetValue: row.targetValue ?? null,
        unit: row.unit ?? null,
      })),
      total: typeof data.total === 'number' ? data.total : 0,
    }
  },
}) as unknown as InsightsAiToolDefinition

const getKpiCompletionInput = z
  .object({
    periodType: z.enum(['year', 'quarter', 'month']),
    periodKey: z.string().min(1),
    asOf: z.string().optional(),
    includeDescendants: z.boolean().optional(),
  })
  .passthrough()

const getKpiCompletionTool = defineApiBackedAiTool({
  name: 'insights.get_kpi_completion',
  displayName: 'Get KPI completion',
  description:
    'Compute KPI target completion rates using commercial.metrics actuals. Cite metric formulas from the response.',
  inputSchema: getKpiCompletionInput,
  requiredFeatures: ['insights.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as InsightsToolContext)
    const query: Record<string, string> = {
      organizationId: String((ctx as InsightsToolContext).organizationId),
      periodType: input.periodType,
      periodKey: input.periodKey,
      includeDescendants: input.includeDescendants ? 'true' : 'false',
    }
    if (input.asOf) query.asOf = input.asOf
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/insights/kpi/completion',
      query,
    }
    return operation
  },
  mapResponse: (response) => response.data ?? {},
}) as unknown as InsightsAiToolDefinition

export const aiTools: InsightsAiToolDefinition[] = [listKpiTargetsTool, getKpiCompletionTool]

export default aiTools
