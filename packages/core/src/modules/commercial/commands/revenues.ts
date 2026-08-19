import { registerCommand } from '@helios/shared/lib/commands'
import type { CommandHandler } from '@helios/shared/lib/commands'
import { buildChanges, requireId, emitCrudSideEffects } from '@helios/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@helios/shared/lib/commands/undo'
import { makeCreateRedo } from '@helios/shared/lib/commands/redo'
import { withAtomicFlush } from '@helios/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@helios/shared/lib/crud/errors'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { ProjectRevenue } from '../data/entities'
import {
  revenueCreateSchema,
  revenueUpdateSchema,
  revenueDeleteSchema,
  type RevenueCreateInput,
  type RevenueUpdateInput,
  type RevenueDeleteInput,
} from '../data/validators'
import type { CrudEventsConfig } from '@helios/shared/lib/crud/types'
import type { DataEngine } from '@helios/shared/lib/data/engine'
import { buildCommercialCommandWhere, ensureCommercialCommandScope } from './scope'

const revenueCrudEvents: CrudEventsConfig = {
  module: 'commercial',
  entity: 'project_revenue',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type RevenueSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  projectId: string
  contractId: string | null
  dataVersion: string
  amount: string
  currencyCode: string
  recognizedOn: string
  note: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type RevenueUndoPayload = UndoPayload<RevenueSnapshot>

const REVENUE_FIELDS = [
  'projectId',
  'contractId',
  'dataVersion',
  'amount',
  'currencyCode',
  'recognizedOn',
  'note',
  'isActive',
] as const

async function loadRevenueSnapshot(
  em: EntityManager,
  id: string,
  ctx: Parameters<typeof buildCommercialCommandWhere>[0],
): Promise<RevenueSnapshot | null> {
  const record = await em.findOne(ProjectRevenue, buildCommercialCommandWhere<ProjectRevenue>(ctx, { id }))
  if (!record) return null
  ensureCommercialCommandScope(ctx, record)
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    projectId: record.projectId,
    contractId: record.contractId ?? null,
    dataVersion: record.dataVersion,
    amount: record.amount,
    currencyCode: record.currencyCode,
    recognizedOn: record.recognizedOn,
    note: record.note ?? null,
    isActive: !!record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createRevenueCommand: CommandHandler<RevenueCreateInput, { revenueId: string }> = {
  id: 'commercial.revenues.create',
  async execute(input, ctx) {
    const parsed = revenueCreateSchema.parse(input)
    ensureCommercialCommandScope(ctx, parsed)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(ProjectRevenue, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      projectId: parsed.projectId,
      contractId: parsed.contractId ?? null,
      dataVersion: parsed.dataVersion ?? 'actual',
      amount: parsed.amount,
      currencyCode: parsed.currencyCode ?? 'CNY',
      recognizedOn: parsed.recognizedOn,
      note: parsed.note ?? null,
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await withAtomicFlush(em, [() => undefined], { transaction: true, label: 'commercial.revenues.create' })

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
      events: revenueCrudEvents,
    })

    return { revenueId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadRevenueSnapshot(em, result.revenueId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as RevenueSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.revenueCreate', 'Create project revenue'),
      resourceKind: 'commercial.project_revenue',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<RevenueUndoPayload>(logEntry)
    const after = payload?.after ?? null
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectRevenue, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()
  },
  redo: makeCreateRedo<ProjectRevenue, RevenueSnapshot, RevenueCreateInput, { revenueId: string }>({
    entityClass: ProjectRevenue,
    buildResult: (entity) => ({ revenueId: entity.id }),
    events: revenueCrudEvents,
  }),
}

const updateRevenueCommand: CommandHandler<RevenueUpdateInput, { revenueId: string }> = {
  id: 'commercial.revenues.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Revenue ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadRevenueSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = revenueUpdateSchema.parse(input)
    requireId(parsed.id, 'Revenue ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      ProjectRevenue,
      buildCommercialCommandWhere<ProjectRevenue>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Project revenue not found' })
    ensureCommercialCommandScope(ctx, record)

    const allChanges = buildChanges(record as unknown as Record<string, unknown>, parsed, [...REVENUE_FIELDS])
    const changes = Object.fromEntries(
      Object.entries(allChanges).filter(([, change]) => change.to !== undefined),
    ) as Record<string, { from: unknown; to: unknown }>

    if (Object.keys(changes).length === 0) return { revenueId: record.id }

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
      { transaction: true, label: 'commercial.revenues.update' },
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
      events: revenueCrudEvents,
    })

    return { revenueId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadRevenueSnapshot(em, result.revenueId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as RevenueSnapshot | undefined
    const after = snapshots.after as RevenueSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.revenueUpdate', 'Update project revenue'),
      resourceKind: 'commercial.project_revenue',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? undefined,
      snapshotAfter: after,
      payload: { undo: { before, after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<RevenueUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectRevenue, { id: before.id })
    if (!record) return
    Object.assign(record, {
      projectId: before.projectId,
      contractId: before.contractId,
      dataVersion: before.dataVersion,
      amount: before.amount,
      currencyCode: before.currencyCode,
      recognizedOn: before.recognizedOn,
      note: before.note,
      isActive: before.isActive,
      updatedAt: new Date(),
    })
    await em.flush()
  },
}

const deleteRevenueCommand: CommandHandler<RevenueDeleteInput, { revenueId: string }> = {
  id: 'commercial.revenues.delete',
  async prepare(input, ctx) {
    requireId(input.id, 'Revenue ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadRevenueSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = revenueDeleteSchema.parse(input)
    requireId(parsed.id, 'Revenue ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      ProjectRevenue,
      buildCommercialCommandWhere<ProjectRevenue>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Project revenue not found' })
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
      events: revenueCrudEvents,
    })

    return { revenueId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as RevenueSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.revenueDelete', 'Delete project revenue'),
      resourceKind: 'commercial.project_revenue',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<RevenueUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectRevenue, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.isActive = before.isActive
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createRevenueCommand)
registerCommand(updateRevenueCommand)
registerCommand(deleteRevenueCommand)

export { createRevenueCommand, updateRevenueCommand, deleteRevenueCommand }
