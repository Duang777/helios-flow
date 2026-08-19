import { registerCommand } from '@helios/shared/lib/commands'
import type { CommandHandler } from '@helios/shared/lib/commands'
import { buildChanges, requireId, emitCrudSideEffects } from '@helios/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@helios/shared/lib/commands/undo'
import { makeCreateRedo } from '@helios/shared/lib/commands/redo'
import { withAtomicFlush } from '@helios/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@helios/shared/lib/crud/errors'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { CommercialPayment } from '../data/entities'
import {
  paymentCreateSchema,
  paymentUpdateSchema,
  paymentDeleteSchema,
  type PaymentCreateInput,
  type PaymentUpdateInput,
  type PaymentDeleteInput,
} from '../data/validators'
import type { CrudEventsConfig } from '@helios/shared/lib/crud/types'
import type { DataEngine } from '@helios/shared/lib/data/engine'
import { buildCommercialCommandWhere, ensureCommercialCommandScope } from './scope'

const paymentCrudEvents: CrudEventsConfig = {
  module: 'commercial',
  entity: 'payment',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type PaymentSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  customerEntityId: string | null
  paymentNo: string | null
  status: string
  amount: string
  currencyCode: string
  paidOn: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type PaymentUndoPayload = UndoPayload<PaymentSnapshot>

const PAYMENT_FIELDS = ['customerEntityId', 'paymentNo', 'status', 'amount', 'currencyCode', 'paidOn', 'isActive'] as const

async function loadPaymentSnapshot(
  em: EntityManager,
  id: string,
  ctx: Parameters<typeof buildCommercialCommandWhere>[0],
): Promise<PaymentSnapshot | null> {
  const record = await em.findOne(CommercialPayment, buildCommercialCommandWhere<CommercialPayment>(ctx, { id }))
  if (!record) return null
  ensureCommercialCommandScope(ctx, record)
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    customerEntityId: record.customerEntityId ?? null,
    paymentNo: record.paymentNo ?? null,
    status: record.status,
    amount: record.amount,
    currencyCode: record.currencyCode,
    paidOn: record.paidOn,
    isActive: !!record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createPaymentCommand: CommandHandler<PaymentCreateInput, { paymentId: string }> = {
  id: 'commercial.payments.create',
  async execute(input, ctx) {
    const parsed = paymentCreateSchema.parse(input)
    ensureCommercialCommandScope(ctx, parsed)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(CommercialPayment, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      customerEntityId: parsed.customerEntityId ?? null,
      paymentNo: parsed.paymentNo ?? null,
      status: parsed.status ?? 'draft',
      amount: parsed.amount,
      currencyCode: parsed.currencyCode ?? 'CNY',
      paidOn: parsed.paidOn,
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await withAtomicFlush(em, [() => undefined], { transaction: true, label: 'commercial.payments.create' })

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
      events: paymentCrudEvents,
    })

    return { paymentId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadPaymentSnapshot(em, result.paymentId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as PaymentSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.paymentCreate', 'Create payment'),
      resourceKind: 'commercial.payment',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<PaymentUndoPayload>(logEntry)
    const after = payload?.after ?? null
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CommercialPayment, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()
  },
  redo: makeCreateRedo<CommercialPayment, PaymentSnapshot, PaymentCreateInput, { paymentId: string }>({
    entityClass: CommercialPayment,
    buildResult: (entity) => ({ paymentId: entity.id }),
    events: paymentCrudEvents,
  }),
}

const updatePaymentCommand: CommandHandler<PaymentUpdateInput, { paymentId: string }> = {
  id: 'commercial.payments.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Payment ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadPaymentSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = paymentUpdateSchema.parse(input)
    requireId(parsed.id, 'Payment ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      CommercialPayment,
      buildCommercialCommandWhere<CommercialPayment>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Payment not found' })
    ensureCommercialCommandScope(ctx, record)

    const allChanges = buildChanges(record as unknown as Record<string, unknown>, parsed, [...PAYMENT_FIELDS])
    const changes = Object.fromEntries(
      Object.entries(allChanges).filter(([, change]) => change.to !== undefined),
    ) as Record<string, { from: unknown; to: unknown }>

    if (Object.keys(changes).length === 0) return { paymentId: record.id }

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
      { transaction: true, label: 'commercial.payments.update' },
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
      events: paymentCrudEvents,
    })

    return { paymentId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadPaymentSnapshot(em, result.paymentId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as PaymentSnapshot | undefined
    const after = snapshots.after as PaymentSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.paymentUpdate', 'Update payment'),
      resourceKind: 'commercial.payment',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? undefined,
      snapshotAfter: after,
      payload: { undo: { before, after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<PaymentUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CommercialPayment, { id: before.id })
    if (!record) return
    Object.assign(record, {
      customerEntityId: before.customerEntityId,
      paymentNo: before.paymentNo,
      status: before.status,
      amount: before.amount,
      currencyCode: before.currencyCode,
      paidOn: before.paidOn,
      isActive: before.isActive,
      updatedAt: new Date(),
    })
    await em.flush()
  },
}

const deletePaymentCommand: CommandHandler<PaymentDeleteInput, { paymentId: string }> = {
  id: 'commercial.payments.delete',
  async prepare(input, ctx) {
    requireId(input.id, 'Payment ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadPaymentSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = paymentDeleteSchema.parse(input)
    requireId(parsed.id, 'Payment ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      CommercialPayment,
      buildCommercialCommandWhere<CommercialPayment>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Payment not found' })
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
      events: paymentCrudEvents,
    })

    return { paymentId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as PaymentSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.paymentDelete', 'Delete payment'),
      resourceKind: 'commercial.payment',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<PaymentUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CommercialPayment, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.isActive = before.isActive
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createPaymentCommand)
registerCommand(updatePaymentCommand)
registerCommand(deletePaymentCommand)

export { createPaymentCommand, updatePaymentCommand, deletePaymentCommand }
