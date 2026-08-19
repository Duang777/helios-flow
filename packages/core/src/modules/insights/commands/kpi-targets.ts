import { registerCommand } from '@helios/shared/lib/commands'
import type { CommandHandler } from '@helios/shared/lib/commands'
import { buildChanges, requireId, emitCrudSideEffects } from '@helios/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@helios/shared/lib/commands/undo'
import { makeCreateRedo } from '@helios/shared/lib/commands/redo'
import { withAtomicFlush } from '@helios/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@helios/shared/lib/crud/errors'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { KpiTarget } from '../data/entities'
import {
  kpiTargetCreateSchema,
  kpiTargetUpdateSchema,
  kpiTargetDeleteSchema,
  type KpiTargetCreateInput,
  type KpiTargetUpdateInput,
  type KpiTargetDeleteInput,
} from '../data/validators'
import type { CrudEventsConfig } from '@helios/shared/lib/crud/types'
import type { DataEngine } from '@helios/shared/lib/data/engine'
import { buildInsightsCommandWhere, ensureInsightsCommandScope } from './scope'

const kpiTargetCrudEvents: CrudEventsConfig = {
  module: 'insights',
  entity: 'kpi_target',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type KpiTargetSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  metricKey: string
  unit: string
  periodType: string
  periodKey: string
  targetValue: string
  currencyCode: string | null
  note: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type KpiTargetUndoPayload = UndoPayload<KpiTargetSnapshot>

const KPI_TARGET_FIELDS = [
  'metricKey',
  'unit',
  'periodType',
  'periodKey',
  'targetValue',
  'currencyCode',
  'note',
  'isActive',
] as const

async function loadKpiTargetSnapshot(
  em: EntityManager,
  id: string,
  ctx: Parameters<typeof buildInsightsCommandWhere>[0],
): Promise<KpiTargetSnapshot | null> {
  const record = await em.findOne(KpiTarget, buildInsightsCommandWhere<KpiTarget>(ctx, { id }))
  if (!record) return null
  ensureInsightsCommandScope(ctx, record)
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    metricKey: record.metricKey,
    unit: record.unit,
    periodType: record.periodType,
    periodKey: record.periodKey,
    targetValue: record.targetValue,
    currencyCode: record.currencyCode ?? null,
    note: record.note ?? null,
    isActive: !!record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createKpiTargetCommand: CommandHandler<KpiTargetCreateInput, { kpiTargetId: string }> = {
  id: 'insights.kpi_targets.create',
  async execute(input, ctx) {
    const parsed = kpiTargetCreateSchema.parse(input)
    ensureInsightsCommandScope(ctx, parsed)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(KpiTarget, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      metricKey: parsed.metricKey,
      unit: parsed.unit,
      periodType: parsed.periodType,
      periodKey: parsed.periodKey,
      targetValue: parsed.targetValue,
      currencyCode: parsed.unit === 'amount' ? (parsed.currencyCode ?? 'CNY') : null,
      note: parsed.note ?? null,
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await withAtomicFlush(em, [() => undefined], { transaction: true, label: 'insights.kpi_targets.create' })

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
      events: kpiTargetCrudEvents,
    })

    return { kpiTargetId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadKpiTargetSnapshot(em, result.kpiTargetId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as KpiTargetSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('insights.audit.kpiTargetCreate', 'Create KPI target'),
      resourceKind: 'insights.kpi_target',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<KpiTargetUndoPayload>(logEntry)
    const after = payload?.after ?? null
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(KpiTarget, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()
  },
  redo: makeCreateRedo<KpiTarget, KpiTargetSnapshot, KpiTargetCreateInput, { kpiTargetId: string }>({
    entityClass: KpiTarget,
    buildResult: (entity) => ({ kpiTargetId: entity.id }),
    events: kpiTargetCrudEvents,
  }),
}

const updateKpiTargetCommand: CommandHandler<KpiTargetUpdateInput, { kpiTargetId: string }> = {
  id: 'insights.kpi_targets.update',
  async prepare(input, ctx) {
    requireId(input.id, 'KPI target ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadKpiTargetSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = kpiTargetUpdateSchema.parse(input)
    requireId(parsed.id, 'KPI target ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      KpiTarget,
      buildInsightsCommandWhere<KpiTarget>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'KPI target not found' })
    ensureInsightsCommandScope(ctx, record)

    const allChanges = buildChanges(record as unknown as Record<string, unknown>, parsed, [...KPI_TARGET_FIELDS])
    const changes = Object.fromEntries(
      Object.entries(allChanges).filter(([, change]) => change.to !== undefined),
    ) as Record<string, { from: unknown; to: unknown }>

    if (Object.keys(changes).length === 0) return { kpiTargetId: record.id }

    await withAtomicFlush(
      em,
      [
        () => {
          for (const [key, change] of Object.entries(changes)) {
            ;(record as unknown as Record<string, unknown>)[key] = change.to
          }
          if (record.unit === 'ratio') record.currencyCode = null
          if (record.unit === 'amount' && !record.currencyCode) record.currencyCode = 'CNY'
          record.updatedAt = new Date()
        },
      ],
      { transaction: true, label: 'insights.kpi_targets.update' },
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
      events: kpiTargetCrudEvents,
    })

    return { kpiTargetId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadKpiTargetSnapshot(em, result.kpiTargetId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as KpiTargetSnapshot | undefined
    const after = snapshots.after as KpiTargetSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('insights.audit.kpiTargetUpdate', 'Update KPI target'),
      resourceKind: 'insights.kpi_target',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? undefined,
      snapshotAfter: after,
      payload: { undo: { before, after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<KpiTargetUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(KpiTarget, { id: before.id })
    if (!record) return
    Object.assign(record, {
      metricKey: before.metricKey,
      unit: before.unit,
      periodType: before.periodType,
      periodKey: before.periodKey,
      targetValue: before.targetValue,
      currencyCode: before.currencyCode,
      note: before.note,
      isActive: before.isActive,
      updatedAt: new Date(),
    })
    await em.flush()
  },
}

const deleteKpiTargetCommand: CommandHandler<KpiTargetDeleteInput, { kpiTargetId: string }> = {
  id: 'insights.kpi_targets.delete',
  async prepare(input, ctx) {
    requireId(input.id, 'KPI target ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadKpiTargetSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = kpiTargetDeleteSchema.parse(input)
    requireId(parsed.id, 'KPI target ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      KpiTarget,
      buildInsightsCommandWhere<KpiTarget>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'KPI target not found' })
    ensureInsightsCommandScope(ctx, record)

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
      events: kpiTargetCrudEvents,
    })

    return { kpiTargetId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as KpiTargetSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('insights.audit.kpiTargetDelete', 'Delete KPI target'),
      resourceKind: 'insights.kpi_target',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<KpiTargetUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(KpiTarget, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.isActive = before.isActive
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createKpiTargetCommand)
registerCommand(updateKpiTargetCommand)
registerCommand(deleteKpiTargetCommand)

export { createKpiTargetCommand, updateKpiTargetCommand, deleteKpiTargetCommand }
