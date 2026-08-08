import { registerCommand } from '@helios/shared/lib/commands'
import type { CommandHandler } from '@helios/shared/lib/commands'
import { buildChanges, requireId, emitCrudSideEffects } from '@helios/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@helios/shared/lib/commands/undo'
import { makeCreateRedo } from '@helios/shared/lib/commands/redo'
import { withAtomicFlush } from '@helios/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@helios/shared/lib/crud/errors'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { CommercialInvoice } from '../data/entities'
import {
  invoiceCreateSchema,
  invoiceUpdateSchema,
  invoiceDeleteSchema,
  type InvoiceCreateInput,
  type InvoiceUpdateInput,
  type InvoiceDeleteInput,
} from '../data/validators'
import type { CrudEventsConfig } from '@helios/shared/lib/crud/types'
import type { DataEngine } from '@helios/shared/lib/data/engine'
import { buildCommercialCommandWhere, ensureCommercialCommandScope } from './scope'

const invoiceCrudEvents: CrudEventsConfig = {
  module: 'commercial',
  entity: 'invoice',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type InvoiceSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  contractId: string | null
  projectId: string | null
  customerEntityId: string | null
  invoiceNo: string | null
  status: string
  amount: string
  currencyCode: string
  issuedOn: string
  dueDate: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type InvoiceUndoPayload = UndoPayload<InvoiceSnapshot>

const INVOICE_FIELDS = [
  'contractId',
  'projectId',
  'customerEntityId',
  'invoiceNo',
  'status',
  'amount',
  'currencyCode',
  'issuedOn',
  'dueDate',
  'isActive',
] as const

async function loadInvoiceSnapshot(
  em: EntityManager,
  id: string,
  ctx: Parameters<typeof buildCommercialCommandWhere>[0],
): Promise<InvoiceSnapshot | null> {
  const record = await em.findOne(CommercialInvoice, buildCommercialCommandWhere<CommercialInvoice>(ctx, { id }))
  if (!record) return null
  ensureCommercialCommandScope(ctx, record)
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    contractId: record.contractId ?? null,
    projectId: record.projectId ?? null,
    customerEntityId: record.customerEntityId ?? null,
    invoiceNo: record.invoiceNo ?? null,
    status: record.status,
    amount: record.amount,
    currencyCode: record.currencyCode,
    issuedOn: record.issuedOn,
    dueDate: record.dueDate ?? null,
    isActive: !!record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createInvoiceCommand: CommandHandler<InvoiceCreateInput, { invoiceId: string }> = {
  id: 'commercial.invoices.create',
  async execute(input, ctx) {
    const parsed = invoiceCreateSchema.parse(input)
    ensureCommercialCommandScope(ctx, parsed)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(CommercialInvoice, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      contractId: parsed.contractId ?? null,
      projectId: parsed.projectId ?? null,
      customerEntityId: parsed.customerEntityId ?? null,
      invoiceNo: parsed.invoiceNo ?? null,
      status: parsed.status ?? 'draft',
      amount: parsed.amount,
      currencyCode: parsed.currencyCode ?? 'CNY',
      issuedOn: parsed.issuedOn,
      dueDate: parsed.dueDate ?? null,
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await withAtomicFlush(em, [() => undefined], { transaction: true, label: 'commercial.invoices.create' })

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: record,
      identifiers: {
        id: record.id,
        organizationId: record.organizationId,
        tenantId: record.tenantId,
      },
      events: invoiceCrudEvents,
    })

    return { invoiceId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadInvoiceSnapshot(em, result.invoiceId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as InvoiceSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.invoiceCreate', 'Create invoice'),
      resourceKind: 'commercial.invoice',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<InvoiceUndoPayload>(logEntry)
    const after = payload?.after ?? null
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CommercialInvoice, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()
  },
  redo: makeCreateRedo<CommercialInvoice, InvoiceSnapshot, InvoiceCreateInput, { invoiceId: string }>({
    entityClass: CommercialInvoice,
    buildResult: (entity) => ({ invoiceId: entity.id }),
    events: invoiceCrudEvents,
  }),
}

const updateInvoiceCommand: CommandHandler<InvoiceUpdateInput, { invoiceId: string }> = {
  id: 'commercial.invoices.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Invoice ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadInvoiceSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = invoiceUpdateSchema.parse(input)
    requireId(parsed.id, 'Invoice ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      CommercialInvoice,
      buildCommercialCommandWhere<CommercialInvoice>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Invoice not found' })
    ensureCommercialCommandScope(ctx, record)

    const allChanges = buildChanges(record as unknown as Record<string, unknown>, parsed, [...INVOICE_FIELDS])
    const changes = Object.fromEntries(
      Object.entries(allChanges).filter(([, change]) => change.to !== undefined),
    ) as Record<string, { from: unknown; to: unknown }>

    if (Object.keys(changes).length === 0) return { invoiceId: record.id }

    await withAtomicFlush(
      em,
      [
        () => {
          for (const [key, change] of Object.entries(changes)) {
            ;(record as unknown as Record<string, unknown>)[key] = change.to
          }
          record.updatedAt = new Date()
        },
      ],
      { transaction: true, label: 'commercial.invoices.update' },
    )

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: record,
      identifiers: {
        id: record.id,
        organizationId: record.organizationId,
        tenantId: record.tenantId,
      },
      events: invoiceCrudEvents,
    })

    return { invoiceId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadInvoiceSnapshot(em, result.invoiceId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as InvoiceSnapshot | undefined
    const after = snapshots.after as InvoiceSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.invoiceUpdate', 'Update invoice'),
      resourceKind: 'commercial.invoice',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? undefined,
      snapshotAfter: after,
      payload: { undo: { before, after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<InvoiceUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CommercialInvoice, { id: before.id })
    if (!record) return
    Object.assign(record, {
      contractId: before.contractId,
      projectId: before.projectId,
      customerEntityId: before.customerEntityId,
      invoiceNo: before.invoiceNo,
      status: before.status,
      amount: before.amount,
      currencyCode: before.currencyCode,
      issuedOn: before.issuedOn,
      dueDate: before.dueDate,
      isActive: before.isActive,
      updatedAt: new Date(),
    })
    await em.flush()
  },
}

const deleteInvoiceCommand: CommandHandler<InvoiceDeleteInput, { invoiceId: string }> = {
  id: 'commercial.invoices.delete',
  async prepare(input, ctx) {
    requireId(input.id, 'Invoice ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadInvoiceSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = invoiceDeleteSchema.parse(input)
    requireId(parsed.id, 'Invoice ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      CommercialInvoice,
      buildCommercialCommandWhere<CommercialInvoice>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Invoice not found' })
    ensureCommercialCommandScope(ctx, record)

    record.deletedAt = new Date()
    record.isActive = false
    record.updatedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: record,
      identifiers: {
        id: record.id,
        organizationId: record.organizationId,
        tenantId: record.tenantId,
      },
      events: invoiceCrudEvents,
    })

    return { invoiceId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as InvoiceSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.invoiceDelete', 'Delete invoice'),
      resourceKind: 'commercial.invoice',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<InvoiceUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CommercialInvoice, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.isActive = before.isActive
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createInvoiceCommand)
registerCommand(updateInvoiceCommand)
registerCommand(deleteInvoiceCommand)

export { createInvoiceCommand, updateInvoiceCommand, deleteInvoiceCommand }
