import { z } from 'zod'
import { defineAiTool, defineApiBackedAiTool } from '@helios/ai-assistant'
import {
  createAiApiOperationRunner,
  type AiApiOperationRequest,
  type AiToolExecutionContext,
} from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolDefinition, McpToolContext } from '@helios/ai-assistant/modules/ai_assistant/lib/types'
import { isMilestoneDelayed } from '../lib/milestoneDelay'
import {
  assertTenantScope,
  type ProjectsAiToolDefinition,
  type ProjectsToolContext,
} from './types'

const listProjectsInput = z
  .object({
    q: z.string().trim().optional().describe('Optional search text matched against project name/code.'),
    limit: z.number().int().min(1).max(100).optional().describe('Maximum rows (default 50).'),
    offset: z.number().int().min(0).optional().describe('Rows to skip (default 0).'),
    status: z.string().optional().describe('Filter by project status.'),
    customerEntityId: z.string().uuid().optional().describe('Filter by linked customer entity UUID.'),
    dealId: z.string().uuid().optional().describe('Filter by linked deal UUID.'),
  })
  .passthrough()

type ListProjectsInput = z.infer<typeof listProjectsInput>

type ListProjectsApiResponse = {
  items?: Array<Record<string, unknown>>
  total?: number
}

const listProjectsTool = defineApiBackedAiTool<
  ListProjectsInput,
  ListProjectsApiResponse,
  { items: Array<Record<string, unknown>>; total: number; limit: number; offset: number }
>({
  name: 'projects.list_projects',
  displayName: 'List projects',
  description:
    'Search / list delivery projects for the caller tenant + organization. Returns { items, total, limit, offset }.',
  inputSchema: listProjectsInput,
  requiredFeatures: ['projects.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as ProjectsToolContext)
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const page = Math.floor(offset / limit) + 1
    const query: Record<string, string | number | boolean | null | undefined> = {
      page,
      pageSize: limit,
    }
    if (input.q?.trim()) query.search = input.q.trim()
    if (input.status) query.status = input.status
    if (input.customerEntityId) query.customerEntityId = input.customerEntityId
    if (input.dealId) query.dealId = input.dealId
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/projects/projects',
      query,
    }
    return operation
  },
  mapResponse: (response, input) => {
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const data = (response.data ?? {}) as ListProjectsApiResponse
    const rawItems = Array.isArray(data.items) ? data.items : []
    return {
      items: rawItems.map((row) => ({
        id: row.id,
        name: row.name ?? null,
        code: row.code ?? null,
        status: row.status ?? null,
        customerEntityId: row.customerEntityId ?? row.customer_entity_id ?? null,
        dealId: row.dealId ?? row.deal_id ?? null,
        budgetRevenue: row.budgetRevenue ?? row.budget_revenue ?? null,
        budgetCost: row.budgetCost ?? row.budget_cost ?? null,
        forecastRevenue: row.forecastRevenue ?? row.forecast_revenue ?? null,
        forecastCost: row.forecastCost ?? row.forecast_cost ?? null,
        isActive: row.isActive ?? row.is_active ?? null,
        updatedAt: row.updatedAt ?? row.updated_at ?? null,
        href: typeof row.id === 'string' ? `/backend/projects/${row.id}` : null,
      })),
      total: typeof data.total === 'number' ? data.total : 0,
      limit,
      offset,
    }
  },
}) as unknown as ProjectsAiToolDefinition

const getProjectInput = z.object({
  projectId: z.string().uuid().describe('Project id (UUID).'),
})

type GetProjectInput = z.infer<typeof getProjectInput>

const getProjectTool = defineApiBackedAiTool<
  GetProjectInput,
  ListProjectsApiResponse,
  Record<string, unknown> | null
>({
  name: 'projects.get_project',
  displayName: 'Get project',
  description: 'Fetch a single delivery project by id for the caller tenant + organization.',
  inputSchema: getProjectInput,
  requiredFeatures: ['projects.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as ProjectsToolContext)
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/projects/projects',
      query: { id: input.projectId, page: 1, pageSize: 1 },
    }
    return operation
  },
  mapResponse: (response) => {
    const data = (response.data ?? {}) as ListProjectsApiResponse
    const row = Array.isArray(data.items) ? data.items[0] : null
    if (!row || typeof row.id !== 'string') return null
    return {
      id: row.id,
      name: row.name ?? null,
      code: row.code ?? null,
      status: row.status ?? null,
      customerEntityId: row.customerEntityId ?? row.customer_entity_id ?? null,
      dealId: row.dealId ?? row.deal_id ?? null,
      budgetRevenue: row.budgetRevenue ?? row.budget_revenue ?? null,
      budgetCost: row.budgetCost ?? row.budget_cost ?? null,
      forecastRevenue: row.forecastRevenue ?? row.forecast_revenue ?? null,
      forecastCost: row.forecastCost ?? row.forecast_cost ?? null,
      isActive: row.isActive ?? row.is_active ?? null,
      updatedAt: row.updatedAt ?? row.updated_at ?? null,
      href: `/backend/projects/${row.id}`,
    }
  },
}) as unknown as ProjectsAiToolDefinition

const listMilestonesInput = z
  .object({
    projectId: z.string().uuid().optional().describe('Restrict to milestones of this project.'),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .passthrough()

type ListMilestonesInput = z.infer<typeof listMilestonesInput>

type ListMilestonesApiResponse = {
  items?: Array<Record<string, unknown>>
  total?: number
}

function parseAsOfDate(asOf?: string): Date | undefined {
  if (!asOf) return undefined
  const date = new Date(`${asOf}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const listMilestonesTool = defineApiBackedAiTool<
  ListMilestonesInput,
  ListMilestonesApiResponse,
  { items: Array<Record<string, unknown>>; total: number; limit: number; offset: number }
>({
  name: 'projects.list_milestones',
  displayName: 'List milestones',
  description:
    'List project milestones. Each item includes isDelayed using the default planned-date rule.',
  inputSchema: listMilestonesInput,
  requiredFeatures: ['projects.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as ProjectsToolContext)
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const page = Math.floor(offset / limit) + 1
    const query: Record<string, string | number | boolean | null | undefined> = {
      page,
      pageSize: limit,
    }
    if (input.projectId) query.projectId = input.projectId
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/projects/milestones',
      query,
    }
    return operation
  },
  mapResponse: (response, input) => {
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const data = (response.data ?? {}) as ListMilestonesApiResponse
    const rawItems = Array.isArray(data.items) ? data.items : []
    return {
      items: rawItems.map((row) => {
        const plannedDate = (row.plannedDate ?? row.planned_date ?? null) as string | null
        const actualDate = (row.actualDate ?? row.actual_date ?? null) as string | null
        const status = (row.status ?? null) as string | null
        const delayedFlag =
          typeof row.isDelayed === 'boolean'
            ? row.isDelayed
            : isMilestoneDelayed({ plannedDate, actualDate, status })
        return {
          id: row.id,
          projectId: row.projectId ?? row.project_id ?? null,
          name: row.name ?? null,
          status,
          plannedDate,
          actualDate,
          isDelayed: delayedFlag,
          href: typeof row.id === 'string' ? `/backend/milestones/${row.id}` : null,
        }
      }),
      total: typeof data.total === 'number' ? data.total : 0,
      limit,
      offset,
    }
  },
}) as unknown as ProjectsAiToolDefinition

const getDelaySummaryInput = z
  .object({
    projectId: z.string().uuid().optional().describe('Restrict summary to one project.'),
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .passthrough()

type GetDelaySummaryInput = z.infer<typeof getDelaySummaryInput>

const getDelaySummaryTool = defineApiBackedAiTool<
  GetDelaySummaryInput,
  ListMilestonesApiResponse,
  Record<string, unknown>
>({
  name: 'projects.get_delay_summary',
  displayName: 'Get delay summary',
  description:
    'Summarize delayed milestones using the project delay rule: plannedDate < asOf and actualDate is null, excluding cancelled milestones.',
  inputSchema: getDelaySummaryInput,
  requiredFeatures: ['projects.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as ProjectsToolContext)
    const query: Record<string, string | number> = {
      page: 1,
      pageSize: input.limit ?? 100,
    }
    if (input.projectId) query.projectId = input.projectId
    return {
      method: 'GET',
      path: '/projects/milestones',
      query,
    }
  },
  mapResponse: (response, input) => {
    const data = (response.data ?? {}) as ListMilestonesApiResponse
    const rawItems = Array.isArray(data.items) ? data.items : []
    const asOf = parseAsOfDate(input.asOf)
    const delayedMilestones = rawItems
      .map((row) => {
        const plannedDate = (row.plannedDate ?? row.planned_date ?? null) as string | null
        const actualDate = (row.actualDate ?? row.actual_date ?? null) as string | null
        const status = (row.status ?? null) as string | null
        return {
          id: row.id,
          projectId: row.projectId ?? row.project_id ?? null,
          name: row.name ?? null,
          status,
          plannedDate,
          actualDate,
          isDelayed: isMilestoneDelayed({ plannedDate, actualDate, status, asOf }),
          href: typeof row.id === 'string' ? `/backend/milestones/${row.id}` : null,
        }
      })
      .filter((row) => row.isDelayed)
    return {
      projectId: input.projectId ?? null,
      asOf: input.asOf ?? null,
      delayedCount: delayedMilestones.length,
      delayedMilestones,
      scannedCount: rawItems.length,
      formulaSource:
        'projects.lib.milestoneDelay: plannedDate < asOf and actualDate is null, excluding cancelled milestones.',
      href: input.projectId ? `/backend/projects/${input.projectId}` : '/backend/projects',
    }
  },
}) as unknown as ProjectsAiToolDefinition

const listRisksInput = z
  .object({
    projectId: z.string().uuid().optional().describe('Restrict to risks of this project.'),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .passthrough()

type ListRisksInput = z.infer<typeof listRisksInput>

type ListRisksApiResponse = {
  items?: Array<Record<string, unknown>>
  total?: number
}

const listRisksTool = defineApiBackedAiTool<
  ListRisksInput,
  ListRisksApiResponse,
  { items: Array<Record<string, unknown>>; total: number; limit: number; offset: number }
>({
  name: 'projects.list_risks',
  displayName: 'List project risks',
  description: 'List delivery risks for projects in the caller tenant + organization.',
  inputSchema: listRisksInput,
  requiredFeatures: ['projects.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as ProjectsToolContext)
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const page = Math.floor(offset / limit) + 1
    const query: Record<string, string | number | boolean | null | undefined> = {
      page,
      pageSize: limit,
    }
    if (input.projectId) query.projectId = input.projectId
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/projects/risks',
      query,
    }
    return operation
  },
  mapResponse: (response, input) => {
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const data = (response.data ?? {}) as ListRisksApiResponse
    const rawItems = Array.isArray(data.items) ? data.items : []
    return {
      items: rawItems.map((row) => ({
        id: row.id,
        projectId: row.projectId ?? row.project_id ?? null,
        title: row.title ?? null,
        description: row.description ?? null,
        riskType: row.riskType ?? row.risk_type ?? null,
        status: row.status ?? null,
        ownerEmployeeId: row.ownerEmployeeId ?? row.owner_employee_id ?? null,
        href: typeof row.id === 'string' ? `/backend/risks/${row.id}` : null,
      })),
      total: typeof data.total === 'number' ? data.total : 0,
      limit,
      offset,
    }
  },
}) as unknown as ProjectsAiToolDefinition

const explainDelayRuleInput = z
  .object({})
  .passthrough()

const explainDelayRuleTool = defineAiTool({
  name: 'projects.explain_delay_rule',
  displayName: 'Explain project delay rule',
  description:
    'Explain how a project milestone is classified as delayed (the same logic used by projects.get_delay_summary). ' +
    'Use this to cite the delay rule before answering "why is this milestone delayed".',
  inputSchema: explainDelayRuleInput,
  requiredFeatures: ['projects.view'],
  tags: ['read', 'explain', 'operating-loop', 'projects'],
  isMutation: false,
  async handler(_rawInput: unknown, ctx: McpToolContext) {
    assertTenantScope(ctx as unknown as ProjectsToolContext)
    return {
      ruleId: 'projects.lib.milestoneDelay',
      formula:
        'A milestone is delayed when plannedDate is set, plannedDate < asOf (date-only UTC compare), ' +
        'actualDate is null, and status is not cancelled.',
      edgeCases: [
        'asOf is truncated to the UTC day, so a milestone planned on the evaluation day is not delayed.',
        'Cancelled milestones are excluded even if past their planned date.',
        'A milestone with an actual completion date is never delayed regardless of planned date.',
      ],
      href: '/backend/projects',
    }
  },
}) as unknown as ProjectsAiToolDefinition

const suggestDelayMitigationInput = z
  .object({
    projectId: z.string().uuid().optional().describe('Scope to one project. Omit for org-wide delay context.'),
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Evaluation date (YYYY-MM-DD). Defaults to today.'),
    limit: z.number().int().min(1).max(100).optional().describe('Maximum rows per list (default 50).'),
  })
  .passthrough()

type SuggestDelayMitigationInput = z.infer<typeof suggestDelayMitigationInput>

const delayMitigationSuggestion = z.object({
  milestoneId: z.string().nullable().describe('Milestone the mitigation targets, if any.'),
  riskId: z.string().nullable().describe('Risk the mitigation addresses, if any.'),
  action: z.enum(['replan_date', 'add_resource', 'escalate_owner', 'mitigate_risk']).describe('Recommended action.'),
  ownerRole: z.string().describe('Recommended owner role.'),
})

const SUGGEST_DELAY_MITIGATION_SCHEMA = 'ProjectsDelayMitigationSuggestion'

const suggestDelayMitigationTool = defineAiTool({
  name: 'projects.suggest_delay_mitigation',
  displayName: 'Suggest delay mitigation',
  description:
    'Build structured delay-mitigation suggestions from delayed milestones and open risks. Read-only: the agent fills ' +
    'the proposal, then persists changes through projects.manage_project or risk updates.',
  inputSchema: suggestDelayMitigationInput,
  requiredFeatures: ['projects.view'],
  tags: ['read', 'suggest', 'operating-loop', 'projects'],
  isMutation: false,
  async handler(rawInput: unknown, ctx: McpToolContext) {
    const input = suggestDelayMitigationInput.parse(rawInput)
    assertTenantScope(ctx as unknown as ProjectsToolContext)
    const asOf = input.asOf ?? new Date().toISOString().slice(0, 10)
    const limit = input.limit ?? 50
    const toolCtx: AiToolExecutionContext = { ...ctx, tool: suggestDelayMitigationTool as unknown as AiToolDefinition }
    const runner = createAiApiOperationRunner(toolCtx)
    const milestonesResponse = await runner.run({
      method: 'GET',
      path: '/projects/milestones',
      query: { page: 1, pageSize: limit, ...(input.projectId ? { projectId: input.projectId } : {}) },
    })
    if (!milestonesResponse.success) {
      throw new Error(milestonesResponse.error ?? 'Failed to load milestones for delay suggestions.')
    }
    const milestoneData = (milestonesResponse.data ?? {}) as ListMilestonesApiResponse
    const delayedMilestones = (Array.isArray(milestoneData.items) ? milestoneData.items : [])
      .map((row) => {
        const plannedDate = (row.plannedDate ?? row.planned_date ?? null) as string | null
        const actualDate = (row.actualDate ?? row.actual_date ?? null) as string | null
        const status = (row.status ?? null) as string | null
        return {
          id: row.id,
          name: (row.name ?? null) as string | null,
          plannedDate,
          actualDate,
          isDelayed: isMilestoneDelayed({ plannedDate, actualDate, status, asOf: new Date(`${asOf}T00:00:00.000Z`) }),
          href: typeof row.id === 'string' ? `/backend/milestones/${row.id}` : null,
        }
      })
      .filter((row) => row.isDelayed)
    const risksResponse = await runner.run({
      method: 'GET',
      path: '/projects/risks',
      query: { page: 1, pageSize: limit, ...(input.projectId ? { projectId: input.projectId } : {}) },
    })
    const riskData = (risksResponse.success ? (risksResponse.data ?? {}) : {}) as ListRisksApiResponse
    const risks = (Array.isArray(riskData.items) ? riskData.items : []).map((row) => ({
      id: row.id,
      title: (row.title ?? null) as string | null,
      riskType: (row.riskType ?? row.risk_type ?? null) as string | null,
      status: (row.status ?? null) as string | null,
      href: typeof row.id === 'string' ? `/backend/risks/${row.id}` : null,
    }))
    return {
      found: true,
      projectId: input.projectId ?? null,
      asOf,
      context: { delayedMilestones, risks },
      proposal: { mitigations: [] as Array<z.infer<typeof delayMitigationSuggestion>> },
      outputSchemaDescriptor: {
        schemaName: SUGGEST_DELAY_MITIGATION_SCHEMA,
        jsonSchema: z.toJSONSchema(delayMitigationSuggestion) as Record<string, unknown>,
      },
      href: input.projectId ? `/backend/projects/${input.projectId}` : '/backend/projects',
    }
  },
}) as unknown as ProjectsAiToolDefinition

const projectsAiTools: ProjectsAiToolDefinition[] = [
  listProjectsTool,
  getProjectTool,
  listMilestonesTool,
  getDelaySummaryTool,
  explainDelayRuleTool,
  suggestDelayMitigationTool,
  listRisksTool,
]

export default projectsAiTools
