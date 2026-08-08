import { z } from 'zod'
import { defineApiBackedAiTool } from '@helios/ai-assistant/modules/ai_assistant/lib/api-backed-tool'
import type { AiApiOperationRequest } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import {
  assertTenantScope,
  type CommercialAiToolDefinition,
  type CommercialToolContext,
} from './types'

const listContractsInput = z
  .object({
    q: z.string().trim().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
    projectId: z.string().uuid().optional(),
    customerEntityId: z.string().uuid().optional(),
    status: z.string().optional(),
  })
  .passthrough()

type ListContractsInput = z.infer<typeof listContractsInput>

type ListApiResponse = {
  items?: Array<Record<string, unknown>>
  total?: number
}

const listContractsTool = defineApiBackedAiTool<
  ListContractsInput,
  ListApiResponse,
  { items: Array<Record<string, unknown>>; total: number; limit: number; offset: number }
>({
  name: 'commercial.list_contracts',
  displayName: 'List contracts',
  description: 'List commercial contracts for the caller tenant + organization.',
  inputSchema: listContractsInput,
  requiredFeatures: ['commercial.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as CommercialToolContext)
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const page = Math.floor(offset / limit) + 1
    const query: Record<string, string | number | boolean | null | undefined> = {
      page,
      pageSize: limit,
    }
    if (input.q?.trim()) query.search = input.q.trim()
    if (input.projectId) query.projectId = input.projectId
    if (input.customerEntityId) query.customerEntityId = input.customerEntityId
    if (input.status) query.status = input.status
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/commercial/contracts',
      query,
    }
    return operation
  },
  mapResponse: (response, input) => {
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const data = (response.data ?? {}) as ListApiResponse
    const rawItems = Array.isArray(data.items) ? data.items : []
    return {
      items: rawItems.map((row) => ({
        id: row.id,
        name: row.name ?? null,
        code: row.code ?? null,
        status: row.status ?? null,
        amount: row.amount ?? null,
        projectId: row.projectId ?? row.project_id ?? null,
        customerEntityId: row.customerEntityId ?? row.customer_entity_id ?? null,
        href: typeof row.id === 'string' ? `/backend/commercial/contracts/${row.id}` : null,
      })),
      total: typeof data.total === 'number' ? data.total : 0,
      limit,
      offset,
    }
  },
}) as unknown as CommercialAiToolDefinition

const getContractInput = z.object({
  contractId: z.string().uuid(),
})

type GetContractInput = z.infer<typeof getContractInput>

const getContractTool = defineApiBackedAiTool<GetContractInput, ListApiResponse, Record<string, unknown> | null>({
  name: 'commercial.get_contract',
  displayName: 'Get contract',
  description: 'Fetch one commercial contract by id.',
  inputSchema: getContractInput,
  requiredFeatures: ['commercial.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as CommercialToolContext)
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/commercial/contracts',
      query: { id: input.contractId, page: 1, pageSize: 1 },
    }
    return operation
  },
  mapResponse: (response) => {
    const data = (response.data ?? {}) as ListApiResponse
    const row = Array.isArray(data.items) ? data.items[0] : null
    if (!row || typeof row.id !== 'string') return null
    return {
      id: row.id,
      name: row.name ?? null,
      status: row.status ?? null,
      amount: row.amount ?? null,
      projectId: row.projectId ?? row.project_id ?? null,
      href: `/backend/commercial/contracts/${row.id}`,
    }
  },
}) as unknown as CommercialAiToolDefinition

const getMetricsInput = z
  .object({
    asOf: z.string().optional().describe('Metrics cutoff date YYYY-MM-DD'),
    projectId: z.string().uuid().optional(),
    contractId: z.string().uuid().optional(),
  })
  .passthrough()

type GetMetricsInput = z.infer<typeof getMetricsInput>

const getMetricsTool = defineApiBackedAiTool<GetMetricsInput, Record<string, unknown>, Record<string, unknown>>({
  name: 'commercial.get_metrics',
  displayName: 'Get commercial metrics',
  description:
    'Returns PRD §7.9 operating metrics (invoice rate, collection rate, AR, overdue) with formula definitions.',
  inputSchema: getMetricsInput,
  requiredFeatures: ['commercial.view'],
  toOperation: (input, ctx) => {
    const scope = assertTenantScope(ctx as unknown as CommercialToolContext)
    const query: Record<string, string | undefined> = {}
    if (scope.organizationId) query.organizationId = scope.organizationId
    if (input.asOf) query.asOf = input.asOf
    if (input.projectId) query.projectId = input.projectId
    if (input.contractId) query.contractId = input.contractId
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/commercial/metrics',
      query,
    }
    return operation
  },
  mapResponse: (response) => (response.data ?? {}) as Record<string, unknown>,
}) as unknown as CommercialAiToolDefinition

const commercialAiTools: CommercialAiToolDefinition[] = [
  listContractsTool,
  getContractTool,
  getMetricsTool,
]

export default commercialAiTools
