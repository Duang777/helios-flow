import { z } from 'zod'
import { defineApiBackedAiTool } from '@helios/ai-assistant/modules/ai_assistant/lib/api-backed-tool'
import type { AiApiOperationRequest } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import {
  assertTenantScope,
  type SalesAiToolDefinition,
  type SalesToolContext,
} from './types'

const listDocumentsInput = z
  .object({
    q: z.string().trim().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
    customerId: z.string().uuid().optional(),
    channelId: z.string().uuid().optional(),
    status: z.string().optional(),
  })
  .passthrough()

type ListDocumentsInput = z.infer<typeof listDocumentsInput>

type ListApiResponse = {
  items?: Array<Record<string, unknown>>
  total?: number
}

function toListQuery(input: ListDocumentsInput): Record<string, string | number | boolean | null | undefined> {
  const limit = input.limit ?? 50
  const offset = input.offset ?? 0
  const query: Record<string, string | number | boolean | null | undefined> = {
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
  }
  if (input.q?.trim()) query.search = input.q.trim()
  if (input.customerId) query.customerId = input.customerId
  if (input.channelId) query.channelId = input.channelId
  if (input.status) query.status = input.status
  return query
}

function mapDocumentRow(
  row: Record<string, unknown>,
  kind: 'order' | 'quote',
): Record<string, unknown> {
  const id = typeof row.id === 'string' ? row.id : null
  const number = kind === 'order' ? (row.orderNumber ?? null) : (row.quoteNumber ?? null)
  return {
    id,
    number,
    status: row.status ?? null,
    customerEntityId: row.customerEntityId ?? row.customer_entity_id ?? null,
    channelId: row.channelId ?? row.channel_id ?? null,
    currencyCode: row.currencyCode ?? row.currency_code ?? null,
    grandTotalGrossAmount: row.grandTotalGrossAmount ?? row.grand_total_gross_amount ?? null,
    outstandingAmount: row.outstandingAmount ?? row.outstanding_amount ?? null,
    href: id ? `/backend/sales/${kind === 'order' ? 'orders' : 'quotes'}/${id}` : null,
  }
}

function createListTool(kind: 'order' | 'quote'): SalesAiToolDefinition {
  const collection = kind === 'order' ? 'orders' : 'quotes'
  const feature = kind === 'order' ? 'sales.orders.view' : 'sales.quotes.view'
  return defineApiBackedAiTool<
    ListDocumentsInput,
    ListApiResponse,
    { items: Array<Record<string, unknown>>; total: number; limit: number; offset: number }
  >({
    name: kind === 'order' ? 'sales.list_orders' : 'sales.list_quotes',
    displayName: kind === 'order' ? 'List sales orders' : 'List sales quotes',
    description:
      kind === 'order'
        ? 'List sales orders for the caller tenant and organization. Filter by customer, channel, or search text.'
        : 'List sales quotes for the caller tenant and organization. Filter by customer, channel, or search text.',
    inputSchema: listDocumentsInput,
    requiredFeatures: [feature],
    toOperation: (input, ctx) => {
      assertTenantScope(ctx as unknown as SalesToolContext)
      const operation: AiApiOperationRequest = {
        method: 'GET',
        path: `/sales/${collection}`,
        query: toListQuery(input),
      }
      return operation
    },
    mapResponse: (response, input) => {
      const limit = input.limit ?? 50
      const offset = input.offset ?? 0
      const data = (response.data ?? {}) as ListApiResponse
      const rawItems = Array.isArray(data.items) ? data.items : []
      return {
        items: rawItems.map((row) => mapDocumentRow(row, kind)),
        total: typeof data.total === 'number' ? data.total : 0,
        limit,
        offset,
      }
    },
  }) as unknown as SalesAiToolDefinition
}

function createGetTool(kind: 'order' | 'quote'): SalesAiToolDefinition {
  const collection = kind === 'order' ? 'orders' : 'quotes'
  const feature = kind === 'order' ? 'sales.orders.view' : 'sales.quotes.view'
  const idField = kind === 'order' ? 'orderId' : 'quoteId'
  const inputSchema = z.object({
    [idField]: z.string().uuid(),
  })
  type GetInput = { orderId?: string; quoteId?: string }
  return defineApiBackedAiTool<GetInput, ListApiResponse, Record<string, unknown> | null>({
    name: kind === 'order' ? 'sales.get_order' : 'sales.get_quote',
    displayName: kind === 'order' ? 'Get sales order' : 'Get sales quote',
    description:
      kind === 'order'
        ? 'Fetch one sales order by id, including totals and customer link.'
        : 'Fetch one sales quote by id, including totals and customer link.',
    inputSchema,
    requiredFeatures: [feature],
    toOperation: (input, ctx) => {
      assertTenantScope(ctx as unknown as SalesToolContext)
      const id = kind === 'order' ? input.orderId : input.quoteId
      const operation: AiApiOperationRequest = {
        method: 'GET',
        path: `/sales/${collection}`,
        query: { id, page: 1, pageSize: 1 },
      }
      return operation
    },
    mapResponse: (response) => {
      const data = (response.data ?? {}) as ListApiResponse
      const row = Array.isArray(data.items) ? data.items[0] : null
      if (!row || typeof row.id !== 'string') return null
      return mapDocumentRow(row, kind)
    },
  }) as unknown as SalesAiToolDefinition
}

export const salesAiTools: SalesAiToolDefinition[] = [
  createListTool('order'),
  createGetTool('order'),
  createListTool('quote'),
  createGetTool('quote'),
]

export default salesAiTools
