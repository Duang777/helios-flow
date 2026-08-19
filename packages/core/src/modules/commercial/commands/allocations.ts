import { registerCommand } from '@helios/shared/lib/commands'
import type { CommandHandler } from '@helios/shared/lib/commands'
import { buildChanges, requireId, emitCrudSideEffects } from '@helios/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@helios/shared/lib/commands/undo'
import { makeCreateRedo } from '@helios/shared/lib/commands/redo'
import { withAtomicFlush } from '@helios/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@helios/shared/lib/crud/errors'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { PaymentAllocation } from '../data/entities'
import {
  allocationCreateSchema,
  allocationUpdateSchema,
  allocationDeleteSchema,
  type AllocationCreateInput,
  type AllocationUpdateInput,
  type AllocationDeleteInput,
} from '../data/validators'
import type { CrudEventsConfig } from '@helios/shared/lib/crud/types'
import type { DataEngine } from '@helios/shared/lib/data/engine'
import { assertAllocationWithinLimits } from '../lib/allocationGuards'
import { buildCommercialCommandWhere, ensureCommercialCommandScope } from './scope'

const allocationCrudEvents: CrudEventsConfig = {
  module: 'commercial',
  entity: 'payment_allocation',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type AllocationSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  invoiceId: string
  paymentId: string
  allocatedAmount: string
  allocatedOn: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type AllocationUndoPayload = UndoPayload<AllocationSnapshot>

const ALLOCATION_FIELDS = ['invoiceId', 'paymentId', 'allocatedAmount', 'allocatedOn', 'isActive'] as const

async function loadAllocationSnapshot(
  em: EntityManager,
  id: string,
  ctx: Parameters<typeof buildCommercialCommandWhere>[0],
): Promise<AllocationSnapshot | null> {
  const record = await em.findOne(PaymentAllocation, buildCommercialCommandWhere<PaymentAllocation>(ctx, { id }))
  if (!record) return null
  ensureCommercialCommandScope(ctx, record)
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    invoiceId: record.invoiceId,
    paymentId: record.paymentId,
    allocatedAmount: record.allocatedAmount,
    allocatedOn: record.allocatedOn ?? null,
    isActive: !!record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createAllocationCommand: CommandHandler<AllocationCreateInput, { allocationId: string }> = {
  id: 'commercial.allocations.create',
  async execute(input, ctx) {
    const parsed = allocationCreateSchema.parse(input)
    ensureCommercialCommandScope(ctx, parsed)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    await assertAllocationWithinLimits({
      em,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      invoiceId: parsed.invoiceId,
      paymentId: parsed.paymentId,
      allocatedAmount: parsed.allocatedAmount,
    })

    const now = new Date()
    const record = em.create(PaymentAllocation, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      invoiceId: parsed.invoiceId,
      paymentId: parsed.paymentId,
      allocatedAmount: parsed.allocatedAmount,
      allocatedOn: parsed.allocatedOn ?? null,
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await withAtomicFlush(em, [() => undefined], { transaction: true, label: 'commercial.allocations.create' })

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
      events: allocationCrudEvents,
    })

    return { allocationId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadAllocationSnapshot(em, result.allocationId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as AllocationSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.allocationCreate', 'Create payment allocation'),
      resourceKind: 'commercial.payment_allocation',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<AllocationUndoPayload>(logEntry)
    const after = payload?.after ?? null
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(PaymentAllocation, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()
  },
  redo: makeCreateRedo<PaymentAllocation, AllocationSnapshot, AllocationCreateInput, { allocationId: string }>({
    entityClass: PaymentAllocation,
    buildResult: (entity) => ({ allocationId: entity.id }),
    events: allocationCrudEvents,
  }),
}

const updateAllocationCommand: CommandHandler<AllocationUpdateInput, { allocationId: string }> = {
  id: 'commercial.allocations.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Allocation ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadAllocationSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = allocationUpdateSchema.parse(input)
    requireId(parsed.id, 'Allocation ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      PaymentAllocation,
      buildCommercialCommandWhere<PaymentAllocation>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Payment allocation not found' })
    ensureCommercialCommandScope(ctx, record)

    const allocationFieldsChanged =
      parsed.invoiceId !== undefined || parsed.paymentId !== undefined || parsed.allocatedAmount !== undefined

    if (allocationFieldsChanged) {
      await assertAllocationWithinLimits({
        em,
        tenantId: record.tenantId,
        organizationId: record.organizationId,
        invoiceId: parsed.invoiceId ?? record.invoiceId,
        paymentId: parsed.paymentId ?? record.paymentId,
        allocatedAmount: parsed.allocatedAmount ?? record.allocatedAmount,
        excludeAllocationId: record.id,
      })
    }

    const allChanges = buildChanges(record as unknown as Record<string, unknown>, parsed, [...ALLOCATION_FIELDS])
    const changes = Object.fromEntries(
      Object.entries(allChanges).filter(([, change]) => change.to !== undefined),
    ) as Record<string, { from: unknown; to: unknown }>

    if (Object.keys(changes).length === 0) return { allocationId: record.id }

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
      { transaction: true, label: 'commercial.allocations.update' },
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
      events: allocationCrudEvents,
    })

    return { allocationId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadAllocationSnapshot(em, result.allocationId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as AllocationSnapshot | undefined
    const after = snapshots.after as AllocationSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.allocationUpdate', 'Update payment allocation'),
      resourceKind: 'commercial.payment_allocation',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? undefined,
      snapshotAfter: after,
      payload: { undo: { before, after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<AllocationUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(PaymentAllocation, { id: before.id })
    if (!record) return
    Object.assign(record, {
      invoiceId: before.invoiceId,
      paymentId: before.paymentId,
      allocatedAmount: before.allocatedAmount,
      allocatedOn: before.allocatedOn,
      isActive: before.isActive,
      updatedAt: new Date(),
    })
    await em.flush()
  },
}

const deleteAllocationCommand: CommandHandler<AllocationDeleteInput, { allocationId: string }> = {
  id: 'commercial.allocations.delete',
  async prepare(input, ctx) {
    requireId(input.id, 'Allocation ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadAllocationSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = allocationDeleteSchema.parse(input)
    requireId(parsed.id, 'Allocation ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      PaymentAllocation,
      buildCommercialCommandWhere<PaymentAllocation>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Payment allocation not found' })
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
      events: allocationCrudEvents,
    })

    return { allocationId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as AllocationSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.allocationDelete', 'Delete payment allocation'),
      resourceKind: 'commercial.payment_allocation',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<AllocationUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(PaymentAllocation, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.isActive = before.isActive
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createAllocationCommand)
registerCommand(updateAllocationCommand)
registerCommand(deleteAllocationCommand)

export { createAllocationCommand, updateAllocationCommand, deleteAllocationCommand }
