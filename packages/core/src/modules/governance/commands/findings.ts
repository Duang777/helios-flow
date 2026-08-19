import { registerCommand } from '@helios/shared/lib/commands'
import type { CommandHandler } from '@helios/shared/lib/commands'
import { buildChanges, requireId, emitCrudSideEffects } from '@helios/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@helios/shared/lib/commands/undo'
import { makeCreateRedo } from '@helios/shared/lib/commands/redo'
import { withAtomicFlush } from '@helios/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@helios/shared/lib/crud/errors'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { GovernanceFinding, type GovernanceEvidenceItem } from '../data/entities'
import {
  findingCreateSchema,
  findingUpdateSchema,
  findingDeleteSchema,
  type FindingCreateInput,
  type FindingUpdateInput,
  type FindingDeleteInput,
} from '../data/validators'
import type { CrudEventsConfig } from '@helios/shared/lib/crud/types'
import type { DataEngine } from '@helios/shared/lib/data/engine'
import { buildGovernanceCommandWhere, ensureGovernanceCommandScope } from './scope'

const findingCrudEvents: CrudEventsConfig = {
  module: 'governance',
  entity: 'finding',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type FindingSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  ruleId: string
  severity: string
  status: string
  title: string
  reason: string
  evidenceIds: GovernanceEvidenceItem[]
  subjectType: string
  subjectId: string
  impactSummary: string | null
  ownerRole: string | null
  suggestedDueOn: string | null
  payload: Record<string, unknown> | null
  detectedAt: string
  asOf: string
  isSimulation: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type FindingUndoPayload = UndoPayload<FindingSnapshot>

const FINDING_FIELDS = [
  'severity',
  'status',
  'title',
  'reason',
  'evidenceIds',
  'impactSummary',
  'ownerRole',
  'suggestedDueOn',
  'payload',
  'isSimulation',
  'isActive',
] as const

async function loadFindingSnapshot(
  em: EntityManager,
  id: string,
  ctx: Parameters<typeof buildGovernanceCommandWhere>[0],
): Promise<FindingSnapshot | null> {
  const record = await em.findOne(
    GovernanceFinding,
    buildGovernanceCommandWhere<GovernanceFinding>(ctx, { id }),
  )
  if (!record) return null
  ensureGovernanceCommandScope(ctx, record)
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    ruleId: record.ruleId,
    severity: record.severity,
    status: record.status,
    title: record.title,
    reason: record.reason,
    evidenceIds: record.evidenceIds ?? [],
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    impactSummary: record.impactSummary ?? null,
    ownerRole: record.ownerRole ?? null,
    suggestedDueOn: record.suggestedDueOn ?? null,
    payload: record.payload ?? null,
    detectedAt: record.detectedAt.toISOString(),
    asOf: record.asOf,
    isSimulation: !!record.isSimulation,
    isActive: !!record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createFindingCommand: CommandHandler<FindingCreateInput, { findingId: string }> = {
  id: 'governance.findings.create',
  async execute(input, ctx) {
    const parsed = findingCreateSchema.parse(input)
    ensureGovernanceCommandScope(ctx, parsed)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(GovernanceFinding, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      ruleId: parsed.ruleId,
      severity: parsed.severity,
      status: parsed.status ?? 'open',
      title: parsed.title,
      reason: parsed.reason,
      evidenceIds: parsed.evidenceIds ?? [],
      subjectType: parsed.subjectType,
      subjectId: parsed.subjectId,
      impactSummary: parsed.impactSummary ?? null,
      ownerRole: parsed.ownerRole ?? null,
      suggestedDueOn: parsed.suggestedDueOn ?? null,
      payload: parsed.payload ?? null,
      detectedAt: parsed.detectedAt ? new Date(parsed.detectedAt) : now,
      asOf: parsed.asOf,
      isSimulation: parsed.isSimulation === true,
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await withAtomicFlush(em, [() => undefined], { transaction: true, label: 'governance.findings.create' })

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
      events: findingCrudEvents,
    })

    return { findingId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadFindingSnapshot(em, result.findingId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as FindingSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('governance.audit.findingCreate', 'Create finding'),
      resourceKind: 'governance.finding',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<FindingUndoPayload>(logEntry)
    const after = payload?.after ?? null
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(GovernanceFinding, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()
  },
  redo: makeCreateRedo<GovernanceFinding, FindingSnapshot, FindingCreateInput, { findingId: string }>({
    entityClass: GovernanceFinding,
    buildResult: (entity) => ({ findingId: entity.id }),
    events: findingCrudEvents,
  }),
}

const updateFindingCommand: CommandHandler<FindingUpdateInput, { findingId: string }> = {
  id: 'governance.findings.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Finding ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadFindingSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = findingUpdateSchema.parse(input)
    requireId(parsed.id, 'Finding ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      GovernanceFinding,
      buildGovernanceCommandWhere<GovernanceFinding>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Finding not found' })
    ensureGovernanceCommandScope(ctx, record)

    const allChanges = buildChanges(
      record as unknown as Record<string, unknown>,
      parsed,
      [...FINDING_FIELDS],
    )
    const changes = Object.fromEntries(
      Object.entries(allChanges).filter(([, change]) => change.to !== undefined),
    ) as Record<string, { from: unknown; to: unknown }>

    if (Object.keys(changes).length === 0) return { findingId: record.id }

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
      { transaction: true, label: 'governance.findings.update' },
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
      events: findingCrudEvents,
    })

    return { findingId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadFindingSnapshot(em, result.findingId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as FindingSnapshot | undefined
    const after = snapshots.after as FindingSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('governance.audit.findingUpdate', 'Update finding'),
      resourceKind: 'governance.finding',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? undefined,
      snapshotAfter: after,
      payload: { undo: { before, after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<FindingUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(GovernanceFinding, { id: before.id })
    if (!record) return
    Object.assign(record, {
      severity: before.severity,
      status: before.status,
      title: before.title,
      reason: before.reason,
      evidenceIds: before.evidenceIds,
      impactSummary: before.impactSummary,
      ownerRole: before.ownerRole,
      suggestedDueOn: before.suggestedDueOn,
      payload: before.payload,
      isSimulation: before.isSimulation,
      isActive: before.isActive,
      updatedAt: new Date(),
    })
    await em.flush()
  },
}

const deleteFindingCommand: CommandHandler<FindingDeleteInput, { findingId: string }> = {
  id: 'governance.findings.delete',
  async prepare(input, ctx) {
    requireId(input.id, 'Finding ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadFindingSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = findingDeleteSchema.parse(input)
    requireId(parsed.id, 'Finding ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      GovernanceFinding,
      buildGovernanceCommandWhere<GovernanceFinding>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Finding not found' })
    ensureGovernanceCommandScope(ctx, record)

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
      events: findingCrudEvents,
    })

    return { findingId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as FindingSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('governance.audit.findingDelete', 'Delete finding'),
      resourceKind: 'governance.finding',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<FindingUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(GovernanceFinding, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.isActive = before.isActive
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createFindingCommand)
registerCommand(updateFindingCommand)
registerCommand(deleteFindingCommand)

export { createFindingCommand, updateFindingCommand, deleteFindingCommand }
