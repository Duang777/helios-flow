import { z } from 'zod'
import { defineApiBackedAiTool } from '@helios/ai-assistant/modules/ai_assistant/lib/api-backed-tool'
import type { AiApiOperationRequest } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
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

const projectsAiTools: ProjectsAiToolDefinition[] = [
  listProjectsTool,
  getProjectTool,
  listMilestonesTool,
  listRisksTool,
]

export default projectsAiTools
