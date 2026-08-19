import { z } from 'zod'
import { defineApiBackedAiTool } from '@helios/ai-assistant/modules/ai_assistant/lib/api-backed-tool'
import type { AiApiOperationRequest } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import { assertTenantScope, type WmsAiToolDefinition, type WmsToolContext } from './types'

const listInput = z.object({
  q: z.string().trim().optional(),
  warehouseId: z.string().uuid().optional(),
  catalogVariantId: z.string().uuid().optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
})

type ListInput = z.infer<typeof listInput>

type ListApiResponse = {
  items?: Array<Record<string, unknown>>
  total?: number
}

function toPageQuery(input: ListInput): Record<string, string | number | boolean | null | undefined> {
  const limit = input.limit ?? 25
  const offset = input.offset ?? 0
  const query: Record<string, string | number | boolean | null | undefined> = {
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
  }
  if (input.q?.trim()) query.search = input.q.trim()
  if (input.warehouseId) query.warehouseId = input.warehouseId
  if (input.catalogVariantId) query.catalogVariantId = input.catalogVariantId
  if (input.sourceType) query.sourceType = input.sourceType
  if (input.sourceId) query.sourceId = input.sourceId
  return query
}

function pick(row: Record<string, unknown>, camel: string, snake: string): unknown {
  return row[camel] ?? row[snake] ?? null
}

function mapWarehouse(row: Record<string, unknown>): Record<string, unknown> {
  const id = typeof row.id === 'string' ? row.id : null
  return {
    id,
    name: row.name ?? null,
    code: row.code ?? null,
    isActive: pick(row, 'isActive', 'is_active'),
    isPrimary: pick(row, 'isPrimary', 'is_primary'),
    city: row.city ?? null,
    country: row.country ?? null,
    href: id ? `/backend/wms/warehouses` : null,
  }
}

function mapBalance(row: Record<string, unknown>): Record<string, unknown> {
  const id = typeof row.id === 'string' ? row.id : null
  return {
    id,
    warehouseId: pick(row, 'warehouseId', 'warehouse_id'),
    catalogVariantId: pick(row, 'catalogVariantId', 'catalog_variant_id'),
    locationId: pick(row, 'locationId', 'location_id'),
    quantityOnHand: pick(row, 'quantityOnHand', 'quantity_on_hand'),
    quantityReserved: pick(row, 'quantityReserved', 'quantity_reserved'),
    quantityAllocated: pick(row, 'quantityAllocated', 'quantity_allocated'),
    quantityAvailable: pick(row, 'quantityAvailable', 'quantity_available'),
    href: '/backend/wms/inventory',
  }
}

function mapReservation(row: Record<string, unknown>): Record<string, unknown> {
  const id = typeof row.id === 'string' ? row.id : null
  return {
    id,
    warehouseId: pick(row, 'warehouseId', 'warehouse_id'),
    catalogVariantId: pick(row, 'catalogVariantId', 'catalog_variant_id'),
    sourceType: pick(row, 'sourceType', 'source_type'),
    sourceId: pick(row, 'sourceId', 'source_id'),
    status: row.status ?? null,
    quantity: row.quantity ?? null,
    href: '/backend/wms/reservations',
  }
}

function mapList(
  response: { data?: unknown },
  input: ListInput,
  mapper: (row: Record<string, unknown>) => Record<string, unknown>,
) {
  const data = (response.data ?? {}) as ListApiResponse
  const rawItems = Array.isArray(data.items) ? data.items : []
  return {
    items: rawItems.map(mapper),
    total: typeof data.total === 'number' ? data.total : 0,
    limit: input.limit ?? 25,
    offset: input.offset ?? 0,
  }
}

const listWarehousesTool = defineApiBackedAiTool({
  name: 'wms.list_warehouses',
  displayName: 'List warehouses',
  description: 'List warehouses for the caller tenant. Read-only; does not create or edit warehouses.',
  inputSchema: listInput.pick({ q: true, limit: true, offset: true }),
  requiredFeatures: ['wms.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as WmsToolContext)
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/wms/warehouses',
      query: toPageQuery(input),
    }
    return operation
  },
  mapResponse: (response, input) => mapList(response, input, mapWarehouse),
}) as unknown as WmsAiToolDefinition

const listBalancesTool = defineApiBackedAiTool({
  name: 'wms.list_balances',
  displayName: 'List inventory balances',
  description: 'List on-hand, reserved, allocated, and available quantities. Filter by warehouse or catalog variant. Read-only.',
  inputSchema: listInput.pick({ q: true, warehouseId: true, catalogVariantId: true, limit: true, offset: true }),
  requiredFeatures: ['wms.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as WmsToolContext)
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/wms/inventory/balances',
      query: toPageQuery(input),
    }
    return operation
  },
  mapResponse: (response, input) => mapList(response, input, mapBalance),
}) as unknown as WmsAiToolDefinition

const listReservationsTool = defineApiBackedAiTool({
  name: 'wms.list_reservations',
  displayName: 'List inventory reservations',
  description: 'List inventory reservations, including those tied to a sales order via sourceType=order and sourceId. Read-only.',
  inputSchema: listInput,
  requiredFeatures: ['wms.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as WmsToolContext)
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/wms/inventory/reservations',
      query: toPageQuery(input),
    }
    return operation
  },
  mapResponse: (response, input) => mapList(response, input, mapReservation),
}) as unknown as WmsAiToolDefinition

export const wmsAiTools: WmsAiToolDefinition[] = [listWarehousesTool, listBalancesTool, listReservationsTool]

export default wmsAiTools
