import { z } from 'zod'
import { defineApiBackedAiTool } from '@helios/ai-assistant/modules/ai_assistant/lib/api-backed-tool'
import type { AiApiOperationRequest } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import writeAiTools from './ai-tools/write-pack'

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

function organizationIdFromContext(ctx: InsightsToolContext): string {
  assertTenantScope(ctx)
  return String(ctx.organizationId)
}

function decimalOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatDecimal(value: number | null): string | null {
  return value === null ? null : value.toFixed(6)
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

const getKpiGapInput = z
  .object({
    organizationId: z.string().uuid().optional(),
    periodType: z.enum(['year', 'quarter', 'month']),
    periodKey: z.string().min(1),
    asOf: z.string().optional(),
    includeDescendants: z.boolean().optional(),
    metricKey: z.enum(['revenue', 'gross_profit', 'gross_margin', 'collection']).optional(),
  })
  .passthrough()

type CompletionRow = {
  organizationId?: unknown
  metricKey?: unknown
  targetValue?: unknown
  actualValue?: unknown
  completionRate?: unknown
  unit?: unknown
  currencyCode?: unknown
  actualSource?: unknown
  isRollup?: unknown
}

type CompletionPayload = {
  items?: CompletionRow[]
  rollup?: CompletionRow[]
  asOf?: unknown
  periodType?: unknown
  periodKey?: unknown
}

const getKpiGapTool = defineApiBackedAiTool({
  name: 'insights.get_kpi_gap',
  displayName: 'Get KPI target gap',
  description:
    'Explain how far KPI actuals are from target and identify child organizations dragging the period result.',
  inputSchema: getKpiGapInput,
  requiredFeatures: ['insights.view'],
  toOperation: (input, ctx) => {
    const organizationId = input.organizationId ?? organizationIdFromContext(ctx as InsightsToolContext)
    const query: Record<string, string> = {
      organizationId,
      periodType: input.periodType,
      periodKey: input.periodKey,
      includeDescendants: input.includeDescendants ? 'true' : 'false',
    }
    if (input.asOf) query.asOf = input.asOf
    return {
      method: 'GET',
      path: '/insights/kpi/completion',
      query,
    }
  },
  mapResponse: (response, input) => {
    const data = (response.data ?? {}) as CompletionPayload
    const sourceRows = [
      ...(Array.isArray(data.items) ? data.items : []),
      ...(Array.isArray(data.rollup) ? data.rollup : []),
    ]
    const filteredRows = input.metricKey
      ? sourceRows.filter((row) => row.metricKey === input.metricKey)
      : sourceRows
    const rows = filteredRows.map((row) => {
      const target = decimalOrNull(row.targetValue)
      const actual = decimalOrNull(row.actualValue)
      const gap = target === null || actual === null ? null : target - actual
      const status = gap === null ? 'missing_target' : gap > 0 ? 'behind' : 'met_or_ahead'
      return {
        organizationId: typeof row.organizationId === 'string' ? row.organizationId : null,
        metricKey: typeof row.metricKey === 'string' ? row.metricKey : null,
        targetValue: row.targetValue ?? null,
        actualValue: row.actualValue ?? null,
        gapToTarget: formatDecimal(gap),
        completionRate: row.completionRate ?? null,
        unit: row.unit ?? null,
        currencyCode: row.currencyCode ?? null,
        actualSource: row.actualSource ?? null,
        isRollup: row.isRollup === true,
        status,
      }
    })
    const draggedOrganizations = rows
      .filter((row) => row.status === 'behind' && decimalOrNull(row.gapToTarget) !== null)
      .sort((left, right) => (decimalOrNull(right.gapToTarget) ?? 0) - (decimalOrNull(left.gapToTarget) ?? 0))
      .slice(0, 10)

    return {
      rows,
      draggedOrganizations,
      asOf: data.asOf ?? null,
      periodType: data.periodType ?? input.periodType,
      periodKey: data.periodKey ?? input.periodKey,
      formulaSource:
        'completionRate = actualValue ÷ targetValue. gapToTarget = targetValue − actualValue. Ratio targets are stored as 0–100 percent values; company rollup is derived from child organizations.',
      href: '/backend/insights',
    }
  },
}) as unknown as InsightsAiToolDefinition

export const aiTools: InsightsAiToolDefinition[] = [
  listKpiTargetsTool,
  getKpiCompletionTool,
  getKpiGapTool,
  ...writeAiTools,
]

export default aiTools
