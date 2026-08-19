import type { EntityManager } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { defineAiTool } from '@helios/ai-assistant'
import { createAiApiOperationRunner } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolExecutionContext } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolLoadBeforeSingleRecord } from '@helios/ai-assistant/modules/ai_assistant/lib/types'
import { SalesOrder, SalesQuote } from '../data/entities'
import { assertTenantScope, type SalesAiToolDefinition, type SalesToolContext } from './types'

type ManageDocumentInput = z.infer<typeof manageDocumentInput>

const manageDocumentInput = z
  .object({
    orderId: z.string().uuid().optional(),
    quoteId: z.string().uuid().optional(),
    statusEntryId: z.string().uuid().optional(),
    comment: z.string().nullable().optional(),
    customerReference: z.string().nullable().optional(),
    externalReference: z.string().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const hasChange =
      value.statusEntryId !== undefined ||
      value.comment !== undefined ||
      value.customerReference !== undefined ||
      value.externalReference !== undefined
    if (!hasChange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide statusEntryId, comment, customerReference, or externalReference.',
      })
    }
  })

function resolveEm(ctx: SalesToolContext | AiToolExecutionContext): EntityManager {
  return ctx.container.resolve<EntityManager>('em')
}

function recordVersionFromUpdatedAt(updatedAt: Date | null | undefined): string | null {
  return updatedAt ? updatedAt.toISOString() : null
}

function orderSnapshot(row: SalesOrder): Record<string, unknown> {
  return {
    orderNumber: row.orderNumber,
    status: row.status ?? null,
    statusEntryId: row.statusEntryId ?? null,
    comments: row.comments ?? null,
    customerReference: row.customerReference ?? null,
    externalReference: row.externalReference ?? null,
    customerEntityId: row.customerEntityId ?? null,
  }
}

function quoteSnapshot(row: SalesQuote): Record<string, unknown> {
  return {
    quoteNumber: row.quoteNumber,
    status: row.status ?? null,
    statusEntryId: row.statusEntryId ?? null,
    comments: row.comments ?? null,
    customerReference: row.customerReference ?? null,
    externalReference: row.externalReference ?? null,
    customerEntityId: row.customerEntityId ?? null,
  }
}

function patchBody(existingId: string, tenantId: string, organizationId: string, input: ManageDocumentInput) {
  const body: Record<string, unknown> = { id: existingId, tenantId, organizationId }
  if (input.statusEntryId !== undefined) body.statusEntryId = input.statusEntryId
  if (input.comment !== undefined) body.comment = input.comment
  if (input.customerReference !== undefined) body.customerReference = input.customerReference
  if (input.externalReference !== undefined) body.externalReference = input.externalReference
  return body
}

async function loadOrderForScope(
  em: EntityManager,
  ctx: SalesToolContext,
  tenantId: string,
  orderId: string,
): Promise<SalesOrder | null> {
  const row = await em.findOne(SalesOrder, {
    id: orderId,
    tenantId,
    organizationId: ctx.organizationId ?? undefined,
    deletedAt: null,
  })
  if (!row) return null
  if (ctx.organizationId && row.organizationId !== ctx.organizationId) return null
  return row
}

async function loadQuoteForScope(
  em: EntityManager,
  ctx: SalesToolContext,
  tenantId: string,
  quoteId: string,
): Promise<SalesQuote | null> {
  const row = await em.findOne(SalesQuote, {
    id: quoteId,
    tenantId,
    organizationId: ctx.organizationId ?? undefined,
    deletedAt: null,
  })
  if (!row) return null
  if (ctx.organizationId && row.organizationId !== ctx.organizationId) return null
  return row
}

async function loadOrderPreview(
  input: ManageDocumentInput,
  ctx: SalesToolContext,
): Promise<AiToolLoadBeforeSingleRecord | null> {
  const { tenantId } = assertTenantScope(ctx)
  if (!input.orderId) return null
  const row = await loadOrderForScope(resolveEm(ctx), ctx, tenantId, input.orderId)
  if (!row) return null
  return {
    recordId: row.id,
    entityType: 'sales.order',
    recordVersion: recordVersionFromUpdatedAt(row.updatedAt),
    before: orderSnapshot(row),
  }
}

async function loadQuotePreview(
  input: ManageDocumentInput,
  ctx: SalesToolContext,
): Promise<AiToolLoadBeforeSingleRecord | null> {
  const { tenantId } = assertTenantScope(ctx)
  if (!input.quoteId) return null
  const row = await loadQuoteForScope(resolveEm(ctx), ctx, tenantId, input.quoteId)
  if (!row) return null
  return {
    recordId: row.id,
    entityType: 'sales.quote',
    recordVersion: recordVersionFromUpdatedAt(row.updatedAt),
    before: quoteSnapshot(row),
  }
}

const manageOrderInput = manageDocumentInput.superRefine((value, ctx) => {
  if (!value.orderId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'orderId is required.', path: ['orderId'] })
  }
})

const manageQuoteInput = manageDocumentInput.superRefine((value, ctx) => {
  if (!value.quoteId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'quoteId is required.', path: ['quoteId'] })
  }
})

const manageOrderTool = defineAiTool({
  name: 'sales.manage_order',
  displayName: 'Update sales order',
  description:
    'Update an existing sales order (status dictionary entry, comment, or references). Does not create orders or skip workflow states. Requires confirmation.',
  inputSchema: manageOrderInput,
  requiredFeatures: ['sales.orders.manage'],
  isMutation: true,
  loadBeforeRecord: loadOrderPreview,
  async handler(rawInput: ManageDocumentInput, ctx: SalesToolContext) {
    const { tenantId, organizationId } = assertTenantScope(ctx)
    const input = manageOrderInput.parse(rawInput)
    if (!input.orderId) throw new Error('[internal] orderId is required.')
    if (!organizationId) throw new Error('[internal] Organization scope is required to update an order.')
    const em = resolveEm(ctx)
    const existing = await loadOrderForScope(em, ctx, tenantId, input.orderId)
    if (!existing) throw new Error(`Order "${input.orderId}" is not accessible to the caller.`)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)
    const response = await runner.run({
      method: 'PUT',
      path: '/sales/orders',
      body: patchBody(existing.id, tenantId, organizationId, input),
    })
    if (!response.success) throw new Error(response.error ?? `Failed to update order "${existing.id}"`)
    const after = await loadOrderForScope(em, ctx, tenantId, existing.id)
    return {
      orderId: existing.id,
      commandName: 'sales.orders.update',
      before: orderSnapshot(existing),
      after: after ? orderSnapshot(after) : null,
    }
  },
}) as SalesAiToolDefinition

const manageQuoteTool = defineAiTool({
  name: 'sales.manage_quote',
  displayName: 'Update sales quote',
  description:
    'Update an existing sales quote (status dictionary entry, comment, or references). Does not convert quotes to orders. Requires confirmation.',
  inputSchema: manageQuoteInput,
  requiredFeatures: ['sales.quotes.manage'],
  isMutation: true,
  loadBeforeRecord: loadQuotePreview,
  async handler(rawInput: ManageDocumentInput, ctx: SalesToolContext) {
    const { tenantId, organizationId } = assertTenantScope(ctx)
    const input = manageQuoteInput.parse(rawInput)
    if (!input.quoteId) throw new Error('[internal] quoteId is required.')
    if (!organizationId) throw new Error('[internal] Organization scope is required to update a quote.')
    const em = resolveEm(ctx)
    const existing = await loadQuoteForScope(em, ctx, tenantId, input.quoteId)
    if (!existing) throw new Error(`Quote "${input.quoteId}" is not accessible to the caller.`)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)
    const response = await runner.run({
      method: 'PUT',
      path: '/sales/quotes',
      body: patchBody(existing.id, tenantId, organizationId, input),
    })
    if (!response.success) throw new Error(response.error ?? `Failed to update quote "${existing.id}"`)
    const after = await loadQuoteForScope(em, ctx, tenantId, existing.id)
    return {
      quoteId: existing.id,
      commandName: 'sales.quotes.update',
      before: quoteSnapshot(existing),
      after: after ? quoteSnapshot(after) : null,
    }
  },
}) as SalesAiToolDefinition

export const salesWriteAiTools: SalesAiToolDefinition[] = [manageOrderTool, manageQuoteTool]

export default salesWriteAiTools
