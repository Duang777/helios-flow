import { z } from 'zod'
import { defineAiTool } from '@helios/ai-assistant'
import { defineApiBackedAiTool } from '@helios/ai-assistant/modules/ai_assistant/lib/api-backed-tool'
import {
  createAiApiOperationRunner,
  type AiApiOperationRequest,
  type AiToolExecutionContext,
} from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolDefinition, McpToolContext } from '@helios/ai-assistant/modules/ai_assistant/lib/types'
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

type KpiMetricScale = 'absolute' | 'percent_0_100'

type KpiMetricExplanation = {
  metricKey: string
  formula: string
  actualSource: string
  scale: KpiMetricScale
  rollup: string
  caveats: string[]
}

/**
 * Read-only "口径" surface for KPI metrics. The live numbers come from
 * commercial.metrics actuals; this registry explains how each metric is
 * derived and how completion is scored, so the assistant can cite the formula
 * without re-deriving it from the gap computation.
 */
const KPI_METRIC_EXPLANATIONS: Record<string, KpiMetricExplanation> = {
  revenue: {
    metricKey: 'revenue',
    formula:
      'actualValue = commercial actualRevenue (Σ recognized_revenue where data_version = actual). ' +
      'completionRate = actualValue ÷ targetValue.',
    actualSource: 'commercial.metrics.actualRevenue',
    scale: 'absolute',
    rollup: 'Company rollup derives from child organizations; amount scale is currency (CNY, tax-exclusive).',
    caveats: [
      'Actuals come from commercial settlement facts, not the general ledger.',
      'Completion is the ratio of actual to the per-organization target for the period.',
    ],
  },
  gross_profit: {
    metricKey: 'gross_profit',
    formula:
      'actualValue = commercial projectGrossProfit (actualRevenue − actualCost). ' +
      'completionRate = actualValue ÷ targetValue.',
    actualSource: 'commercial.metrics.projectGrossProfit',
    scale: 'absolute',
    rollup: 'Company rollup derives from child organizations; amount scale is currency (CNY, tax-exclusive).',
    caveats: [
      'Actuals come from commercial settlement facts, not the general ledger.',
      'Gross profit can be negative when cost exceeds revenue.',
    ],
  },
  gross_margin: {
    metricKey: 'gross_margin',
    formula:
      'actualValue = commercial projectGrossMargin (projectGrossProfit ÷ actualRevenue). ' +
      'completionRate = actualValue ÷ targetValue.',
    actualSource: 'commercial.metrics.projectGrossMargin',
    scale: 'percent_0_100',
    rollup: 'Company rollup derives from child organizations; percentage scale is 0–100.',
    caveats: [
      'Stored as a 0–100 percent value (e.g. 42 means 42%).',
      'Null when actual revenue is zero, so margin completion is undefined for those organizations.',
    ],
  },
  collection: {
    metricKey: 'collection',
    formula:
      'actualValue = commercial collectionRate (Σ allocated_amount ÷ Σ issued invoice_amount). ' +
      'completionRate = actualValue ÷ targetValue.',
    actualSource: 'commercial.metrics.collectionRate',
    scale: 'percent_0_100',
    rollup: 'Company rollup derives from child organizations; percentage scale is 0–100.',
    caveats: [
      'Stored as a 0–100 percent value (e.g. 88 means 88%).',
      'Only issued invoices count; draft/void invoices are excluded from the denominator.',
    ],
  },
}

const KPI_METRIC_KEYS = Object.keys(KPI_METRIC_EXPLANATIONS) as [string, ...string[]]

const explainKpiMetricInput = z
  .object({
    metricKey: z
      .enum(KPI_METRIC_KEYS)
      .optional()
      .describe('KPI metric key (revenue, gross_profit, gross_margin, collection). Omit to list all.'),
  })
  .passthrough()

type ExplainKpiMetricInput = z.infer<typeof explainKpiMetricInput>

const explainKpiMetricTool = defineAiTool({
  name: 'insights.explain_kpi_metric',
  displayName: 'Explain KPI metric',
  description:
    'Explain how a KPI metric is derived, its scale (absolute vs 0–100 percent), rollup behavior, and caveats. ' +
    'Use this to cite the metric formula source in KPI gap answers.',
  inputSchema: explainKpiMetricInput,
  requiredFeatures: ['insights.view'],
  tags: ['read', 'explain', 'operating-loop', 'insights'],
  isMutation: false,
  async handler(rawInput: unknown, ctx: McpToolContext) {
    assertTenantScope(ctx as InsightsToolContext)
    const input = explainKpiMetricInput.parse(rawInput)
    if (input.metricKey) {
      const explanation = KPI_METRIC_EXPLANATIONS[input.metricKey]
      if (!explanation) {
        return { found: false, metricKey: input.metricKey }
      }
      return { found: true, ...explanation, href: '/backend/insights/kpi' }
    }
    return {
      found: true,
      metrics: KPI_METRIC_KEYS.map((key) => ({
        metricKey: KPI_METRIC_EXPLANATIONS[key].metricKey,
        formula: KPI_METRIC_EXPLANATIONS[key].formula,
        actualSource: KPI_METRIC_EXPLANATIONS[key].actualSource,
        scale: KPI_METRIC_EXPLANATIONS[key].scale,
        href: '/backend/insights/kpi',
      })),
    }
  },
}) as unknown as InsightsAiToolDefinition

const suggestKpiActionsInput = z
  .object({
    organizationId: z.string().uuid().optional(),
    periodType: z.enum(['year', 'quarter', 'month']),
    periodKey: z.string().min(1),
    asOf: z.string().optional(),
    includeDescendants: z.boolean().optional(),
    metricKey: z.enum(['revenue', 'gross_profit', 'gross_margin', 'collection']).optional(),
  })
  .passthrough()

type SuggestKpiActionsInput = z.infer<typeof suggestKpiActionsInput>

const kpiActionSuggestion = z.object({
  organizationId: z.string().describe('Organization the action targets.'),
  metricKey: z.string().describe('KPI metric the action addresses.'),
  action: z.enum(['review_target', 'investigate_actuals', 'assign_owner', 'escalate']).describe('Recommended action.'),
  ownerRole: z.string().describe('Recommended owner role for the action.'),
})

const SUGGEST_KPI_ACTIONS = 'InsightsKpiActionSuggestion'

const suggestKpiActionsTool = defineAiTool({
  name: 'insights.suggest_kpi_actions',
  displayName: 'Suggest KPI actions',
  description:
    'Build structured KPI remediation suggestions for organizations behind target. Read-only: the agent fills the ' +
    'proposal, then persists target changes through insights.manage_kpi_target.',
  inputSchema: suggestKpiActionsInput,
  requiredFeatures: ['insights.view'],
  tags: ['read', 'suggest', 'operating-loop', 'insights'],
  isMutation: false,
  async handler(rawInput: unknown, ctx: McpToolContext) {
    const input = suggestKpiActionsInput.parse(rawInput)
    assertTenantScope(ctx as InsightsToolContext)
    const organizationId =
      input.organizationId ?? organizationIdFromContext(ctx as InsightsToolContext)
    const toolCtx: AiToolExecutionContext = { ...ctx, tool: suggestKpiActionsTool as unknown as AiToolDefinition }
    const runner = createAiApiOperationRunner(toolCtx)
    const query: Record<string, string> = {
      organizationId,
      periodType: input.periodType,
      periodKey: input.periodKey,
      includeDescendants: input.includeDescendants ? 'true' : 'false',
    }
    if (input.asOf) query.asOf = input.asOf
    const response = await runner.run({ method: 'GET', path: '/insights/kpi/completion', query })
    if (!response.success) {
      throw new Error(response.error ?? 'Failed to load KPI completion for action suggestions.')
    }
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
        status,
      }
    })
    const draggedOrganizations = rows
      .filter((row) => row.status === 'behind' && decimalOrNull(row.gapToTarget) !== null)
      .sort((left, right) => (decimalOrNull(right.gapToTarget) ?? 0) - (decimalOrNull(left.gapToTarget) ?? 0))
      .slice(0, 10)
    return {
      found: true,
      organizationId,
      periodType: input.periodType,
      periodKey: input.periodKey,
      context: { rows, draggedOrganizations },
      proposal: { actions: [] as Array<z.infer<typeof kpiActionSuggestion>> },
      // `linkedMutations` closes the two-stage loop: after the agent fills
      // `proposal.actions[]` with {organizationId, metricKey, action, ownerRole},
      // it should pick insights.manage_kpi_target (set/revise the target) and
      // copy `argsTemplate` substituting placeholders. Under `confirm-required`,
      // those calls produce an AiPendingAction and route through the confirm gate.
      linkedMutations: [
        {
          toolName: 'insights.manage_kpi_target',
          purpose:
            'Persist a KPI target. For `review_target` actions, create/update the target for the metric+period. ' +
            'For `investigate_actuals` / `assign_owner` / `escalate`, the agent may include a `note` capturing context.',
          argsTemplate: {
            operation: 'create',
            organizationId: '${organizationId}',
            metricKey: '${metricKey}',
            unit: 'amount',
            periodType: '${periodType}',
            periodKey: '${periodKey}',
            targetValue: '<decimal>',
            currencyCode: 'CNY',
            note: '${action}: ${ownerRole}',
          },
        },
      ],
      outputSchemaDescriptor: {
        schemaName: SUGGEST_KPI_ACTIONS,
        jsonSchema: z.toJSONSchema(kpiActionSuggestion) as Record<string, unknown>,
      },
      href: '/backend/insights',
    }
  },
}) as unknown as InsightsAiToolDefinition

export const aiTools: InsightsAiToolDefinition[] = [
  listKpiTargetsTool,
  getKpiCompletionTool,
  getKpiGapTool,
  explainKpiMetricTool,
  suggestKpiActionsTool,
  ...writeAiTools,
]

export default aiTools
