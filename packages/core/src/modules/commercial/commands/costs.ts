import { registerCommand } from '@helios/shared/lib/commands'
import type { CommandHandler } from '@helios/shared/lib/commands'
import { buildChanges, requireId, emitCrudSideEffects } from '@helios/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@helios/shared/lib/commands/undo'
import { makeCreateRedo } from '@helios/shared/lib/commands/redo'
import { withAtomicFlush } from '@helios/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@helios/shared/lib/crud/errors'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { ProjectCost } from '../data/entities'
import {
  costCreateSchema,
  costUpdateSchema,
  costDeleteSchema,
  type CostCreateInput,
  type CostUpdateInput,
  type CostDeleteInput,
} from '../data/validators'
import type { CrudEventsConfig } from '@helios/shared/lib/crud/types'
import type { DataEngine } from '@helios/shared/lib/data/engine'
import { buildCommercialCommandWhere, ensureCommercialCommandScope } from './scope'

const costCrudEvents: CrudEventsConfig = {
  module: 'commercial',
  entity: 'project_cost',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type CostSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  projectId: string
  contractId: string | null
  dataVersion: string
  costType: string
  amount: string
  currencyCode: string
  incurredOn: string
  note: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type CostUndoPayload = UndoPayload<CostSnapshot>

const COST_FIELDS = [
  'projectId',
  'contractId',
  'dataVersion',
  'costType',
  'amount',
  'currencyCode',
  'incurredOn',
  'note',
  'isActive',
] as const

async function loadCostSnapshot(
  em: EntityManager,
  id: string,
  ctx: Parameters<typeof buildCommercialCommandWhere>[0],
): Promise<CostSnapshot | null> {
  const record = await em.findOne(ProjectCost, buildCommercialCommandWhere<ProjectCost>(ctx, { id }))
  if (!record) return null
  ensureCommercialCommandScope(ctx, record)
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    projectId: record.projectId,
    contractId: record.contractId ?? null,
    dataVersion: record.dataVersion,
    costType: record.costType,
    amount: record.amount,
    currencyCode: record.currencyCode,
    incurredOn: record.incurredOn,
    note: record.note ?? null,
    isActive: !!record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createCostCommand: CommandHandler<CostCreateInput, { costId: string }> = {
  id: 'commercial.costs.create',
  async execute(input, ctx) {
    const parsed = costCreateSchema.parse(input)
    ensureCommercialCommandScope(ctx, parsed)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(ProjectCost, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      projectId: parsed.projectId,
      contractId: parsed.contractId ?? null,
      dataVersion: parsed.dataVersion ?? 'actual',
      costType: parsed.costType ?? 'other',
      amount: parsed.amount,
      currencyCode: parsed.currencyCode ?? 'CNY',
      incurredOn: parsed.incurredOn,
      note: parsed.note ?? null,
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await withAtomicFlush(em, [() => undefined], { transaction: true, label: 'commercial.costs.create' })

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
      events: costCrudEvents,
    })

    return { costId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadCostSnapshot(em, result.costId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as CostSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.costCreate', 'Create project cost'),
      resourceKind: 'commercial.project_cost',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<CostUndoPayload>(logEntry)
    const after = payload?.after ?? null
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectCost, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()
  },
  redo: makeCreateRedo<ProjectCost, CostSnapshot, CostCreateInput, { costId: string }>({
    entityClass: ProjectCost,
    buildResult: (entity) => ({ costId: entity.id }),
    events: costCrudEvents,
  }),
}

const updateCostCommand: CommandHandler<CostUpdateInput, { costId: string }> = {
  id: 'commercial.costs.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Cost ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadCostSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = costUpdateSchema.parse(input)
    requireId(parsed.id, 'Cost ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectCost, buildCommercialCommandWhere<ProjectCost>(ctx, { id: parsed.id }))
    if (!record) throw new CrudHttpError(404, { error: 'Project cost not found' })
    ensureCommercialCommandScope(ctx, record)

    const allChanges = buildChanges(record as unknown as Record<string, unknown>, parsed, [...COST_FIELDS])
    const changes = Object.fromEntries(
      Object.entries(allChanges).filter(([, change]) => change.to !== undefined),
    ) as Record<string, { from: unknown; to: unknown }>

    if (Object.keys(changes).length === 0) return { costId: record.id }

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
      { transaction: true, label: 'commercial.costs.update' },
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
      events: costCrudEvents,
    })

    return { costId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadCostSnapshot(em, result.costId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as CostSnapshot | undefined
    const after = snapshots.after as CostSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.costUpdate', 'Update project cost'),
      resourceKind: 'commercial.project_cost',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? undefined,
      snapshotAfter: after,
      payload: { undo: { before, after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<CostUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectCost, { id: before.id })
    if (!record) return
    Object.assign(record, {
      projectId: before.projectId,
      contractId: before.contractId,
      dataVersion: before.dataVersion,
      costType: before.costType,
      amount: before.amount,
      currencyCode: before.currencyCode,
      incurredOn: before.incurredOn,
      note: before.note,
      isActive: before.isActive,
      updatedAt: new Date(),
    })
    await em.flush()
  },
}

const deleteCostCommand: CommandHandler<CostDeleteInput, { costId: string }> = {
  id: 'commercial.costs.delete',
  async prepare(input, ctx) {
    requireId(input.id, 'Cost ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadCostSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = costDeleteSchema.parse(input)
    requireId(parsed.id, 'Cost ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectCost, buildCommercialCommandWhere<ProjectCost>(ctx, { id: parsed.id }))
    if (!record) throw new CrudHttpError(404, { error: 'Project cost not found' })
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
      events: costCrudEvents,
    })

    return { costId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as CostSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.costDelete', 'Delete project cost'),
      resourceKind: 'commercial.project_cost',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<CostUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectCost, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.isActive = before.isActive
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createCostCommand)
registerCommand(updateCostCommand)
registerCommand(deleteCostCommand)

export { createCostCommand, updateCostCommand, deleteCostCommand }
