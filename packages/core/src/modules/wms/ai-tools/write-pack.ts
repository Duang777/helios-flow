import { z } from 'zod'
import { defineAiTool } from '@helios/ai-assistant'
import {
  createAiApiOperationRunner,
  type AiToolExecutionContext,
} from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolLoadBeforeSingleRecord } from '@helios/ai-assistant/modules/ai_assistant/lib/types'
import { randomUUID } from 'node:crypto'
import { assertTenantScope, type WmsAiToolDefinition, type WmsToolContext } from './types'

const referenceTypeSchema = z.enum(['po', 'so', 'transfer', 'manual', 'qc', 'rma'])

const receiveInput = z.object({
  warehouseId: z.string().uuid(),
  locationId: z.string().uuid(),
  catalogVariantId: z.string().uuid(),
  quantity: z.coerce.number().finite().gt(0),
  lotId: z.string().uuid().optional(),
  lotNumber: z.string().trim().max(120).optional(),
  serialNumber: z.string().trim().max(120).optional(),
  referenceType: referenceTypeSchema.default('manual'),
  referenceId: z.string().uuid().optional(),
  reason: z.string().trim().max(500).optional(),
})

const adjustInput = z.object({
  warehouseId: z.string().uuid(),
  locationId: z.string().uuid(),
  catalogVariantId: z.string().uuid(),
  delta: z.coerce.number().finite().refine((value) => value !== 0, {
    message: 'Inventory delta must be non-zero.',
  }),
  reason: z.string().trim().min(1).max(500),
  reasonCode: z.string().trim().max(80).optional(),
  lotId: z.string().uuid().optional(),
  serialNumber: z.string().trim().max(120).optional(),
  referenceType: referenceTypeSchema.default('manual'),
  referenceId: z.string().uuid().optional(),
})

const moveInput = z.object({
  warehouseId: z.string().uuid(),
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  catalogVariantId: z.string().uuid(),
  quantity: z.coerce.number().finite().gt(0),
  reason: z.string().trim().min(1).max(500),
  reasonCode: z.string().trim().max(80).optional(),
  lotId: z.string().uuid().optional(),
  serialNumber: z.string().trim().max(120).optional(),
  referenceType: referenceTypeSchema.default('manual'),
  referenceId: z.string().uuid().optional(),
})

type ReceiveInput = z.infer<typeof receiveInput>
type AdjustInput = z.infer<typeof adjustInput>
type MoveInput = z.infer<typeof moveInput>

function requireUserId(ctx: WmsToolContext): string {
  if (!ctx.userId) {
    throw new Error('[internal] User context is required for WMS inventory mutations.')
  }
  return ctx.userId
}

function inventoryHref(): string {
  return '/backend/wms/inventory'
}

async function previewReceive(
  input: ReceiveInput,
  _ctx: WmsToolContext,
): Promise<AiToolLoadBeforeSingleRecord> {
  return {
    recordId: `receive:${input.warehouseId}:${input.locationId}:${input.catalogVariantId}`,
    entityType: 'wms.inventory',
    recordVersion: null,
    before: {
      warehouseId: input.warehouseId,
      locationId: input.locationId,
      catalogVariantId: input.catalogVariantId,
      quantity: null,
      operation: 'receive',
    },
    after: {
      warehouseId: input.warehouseId,
      locationId: input.locationId,
      catalogVariantId: input.catalogVariantId,
      quantity: input.quantity,
      operation: 'receive',
      reason: input.reason ?? null,
    },
  }
}

async function previewAdjust(
  input: AdjustInput,
  _ctx: WmsToolContext,
): Promise<AiToolLoadBeforeSingleRecord> {
  return {
    recordId: `adjust:${input.warehouseId}:${input.locationId}:${input.catalogVariantId}`,
    entityType: 'wms.inventory',
    recordVersion: null,
    before: {
      warehouseId: input.warehouseId,
      locationId: input.locationId,
      catalogVariantId: input.catalogVariantId,
      delta: null,
      operation: 'adjust',
    },
    after: {
      warehouseId: input.warehouseId,
      locationId: input.locationId,
      catalogVariantId: input.catalogVariantId,
      delta: input.delta,
      operation: 'adjust',
      reason: input.reason,
    },
  }
}

async function previewMove(
  input: MoveInput,
  _ctx: WmsToolContext,
): Promise<AiToolLoadBeforeSingleRecord> {
  return {
    recordId: `move:${input.warehouseId}:${input.fromLocationId}:${input.toLocationId}:${input.catalogVariantId}`,
    entityType: 'wms.inventory',
    recordVersion: null,
    before: {
      warehouseId: input.warehouseId,
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      catalogVariantId: input.catalogVariantId,
      quantity: null,
      operation: 'move',
    },
    after: {
      warehouseId: input.warehouseId,
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      catalogVariantId: input.catalogVariantId,
      quantity: input.quantity,
      operation: 'move',
      reason: input.reason,
    },
  }
}

const receiveInventoryTool = defineAiTool({
  name: 'wms.receive_inventory',
  displayName: 'Receive inventory',
  description:
    'Record inbound inventory receipt. Confirm-required. Call wms.list_warehouses / wms.list_balances first to resolve warehouse, location, and catalogVariant ids.',
  inputSchema: receiveInput,
  requiredFeatures: ['wms.receive_inventory'],
  isMutation: true,
  loadBeforeRecord: previewReceive,
  async handler(rawInput: ReceiveInput, ctx: WmsToolContext) {
    assertTenantScope(ctx)
    const input = receiveInput.parse(rawInput)
    const performedBy = requireUserId(ctx)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)
    const response = await runner.run<{ ok?: boolean; movementId?: string }>({
      method: 'POST',
      path: '/wms/inventory/receive',
      body: {
        warehouseId: input.warehouseId,
        locationId: input.locationId,
        catalogVariantId: input.catalogVariantId,
        quantity: input.quantity,
        lotId: input.lotId,
        lotNumber: input.lotNumber,
        serialNumber: input.serialNumber,
        referenceType: input.referenceType ?? 'manual',
        referenceId: input.referenceId ?? randomUUID(),
        performedBy,
        reason: input.reason,
      },
    })
    if (!response.success) {
      throw new Error(response.error ?? 'Failed to receive inventory')
    }
    return {
      ok: true,
      movementId: response.data?.movementId ?? null,
      commandName: 'wms.inventory.receive',
      href: inventoryHref(),
    }
  },
}) as WmsAiToolDefinition

const adjustInventoryTool = defineAiTool({
  name: 'wms.adjust_inventory',
  displayName: 'Adjust inventory',
  description:
    'Apply a manual inventory adjustment (positive or negative delta). Confirm-required. Never claim stock changed until the approval card is confirmed.',
  inputSchema: adjustInput,
  requiredFeatures: ['wms.adjust_inventory'],
  isMutation: true,
  loadBeforeRecord: previewAdjust,
  async handler(rawInput: AdjustInput, ctx: WmsToolContext) {
    assertTenantScope(ctx)
    const input = adjustInput.parse(rawInput)
    const performedBy = requireUserId(ctx)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)
    const response = await runner.run<{ ok?: boolean; movementId?: string }>({
      method: 'POST',
      path: '/wms/inventory/adjust',
      body: {
        warehouseId: input.warehouseId,
        locationId: input.locationId,
        catalogVariantId: input.catalogVariantId,
        delta: input.delta,
        reason: input.reason,
        reasonCode: input.reasonCode,
        lotId: input.lotId,
        serialNumber: input.serialNumber,
        referenceType: input.referenceType ?? 'manual',
        referenceId: input.referenceId ?? randomUUID(),
        performedBy,
      },
    })
    if (!response.success) {
      throw new Error(response.error ?? 'Failed to adjust inventory')
    }
    return {
      ok: true,
      movementId: response.data?.movementId ?? null,
      commandName: 'wms.inventory.adjust',
      href: inventoryHref(),
    }
  },
}) as WmsAiToolDefinition

const moveInventoryTool = defineAiTool({
  name: 'wms.move_inventory',
  displayName: 'Move inventory',
  description:
    'Move stock between locations in the same warehouse. Confirm-required. Do not claim the move completed until confirmation.',
  inputSchema: moveInput,
  requiredFeatures: ['wms.adjust_inventory'],
  isMutation: true,
  loadBeforeRecord: previewMove,
  async handler(rawInput: MoveInput, ctx: WmsToolContext) {
    assertTenantScope(ctx)
    const input = moveInput.parse(rawInput)
    const performedBy = requireUserId(ctx)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)
    const response = await runner.run<{ ok?: boolean; movementId?: string }>({
      method: 'POST',
      path: '/wms/inventory/move',
      body: {
        warehouseId: input.warehouseId,
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        catalogVariantId: input.catalogVariantId,
        quantity: input.quantity,
        reason: input.reason,
        reasonCode: input.reasonCode,
        lotId: input.lotId,
        serialNumber: input.serialNumber,
        referenceType: input.referenceType ?? 'manual',
        referenceId: input.referenceId ?? randomUUID(),
        performedBy,
      },
    })
    if (!response.success) {
      throw new Error(response.error ?? 'Failed to move inventory')
    }
    return {
      ok: true,
      movementId: response.data?.movementId ?? null,
      commandName: 'wms.inventory.move',
      href: inventoryHref(),
    }
  },
}) as WmsAiToolDefinition

export const wmsWriteAiTools: WmsAiToolDefinition[] = [
  receiveInventoryTool,
  adjustInventoryTool,
  moveInventoryTool,
]

export default wmsWriteAiTools
