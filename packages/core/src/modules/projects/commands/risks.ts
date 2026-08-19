import { registerCommand } from '@helios/shared/lib/commands'
import type { CommandHandler } from '@helios/shared/lib/commands'
import { buildChanges, requireId, emitCrudSideEffects } from '@helios/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@helios/shared/lib/commands/undo'
import { makeCreateRedo } from '@helios/shared/lib/commands/redo'
import { withAtomicFlush } from '@helios/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@helios/shared/lib/crud/errors'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { Project, ProjectRisk } from '../data/entities'
import {
  riskCreateSchema,
  riskUpdateSchema,
  riskDeleteSchema,
  type RiskCreateInput,
  type RiskUpdateInput,
  type RiskDeleteInput,
} from '../data/validators'
import type { CrudEventsConfig } from '@helios/shared/lib/crud/types'
import type { DataEngine } from '@helios/shared/lib/data/engine'
import { buildProjectsCommandWhere, ensureProjectsCommandScope } from './scope'

const riskCrudEvents: CrudEventsConfig = {
  module: 'projects',
  entity: 'project_risk',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type RiskSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  projectId: string
  title: string
  description: string | null
  riskType: string
  status: string
  ownerEmployeeId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type RiskUndoPayload = UndoPayload<RiskSnapshot>

const RISK_FIELDS = ['projectId', 'title', 'description', 'riskType', 'status', 'ownerEmployeeId', 'isActive'] as const

async function assertProjectInScope(
  em: EntityManager,
  ctx: Parameters<typeof buildProjectsCommandWhere>[0],
  projectId: string,
): Promise<Project> {
  const project = await em.findOne(Project, buildProjectsCommandWhere<Project>(ctx, { id: projectId, deletedAt: null }))
  if (!project) throw new CrudHttpError(404, { error: 'Project not found' })
  ensureProjectsCommandScope(ctx, project)
  return project
}

async function loadRiskSnapshot(
  em: EntityManager,
  id: string,
  ctx: Parameters<typeof buildProjectsCommandWhere>[0],
): Promise<RiskSnapshot | null> {
  const record = await em.findOne(ProjectRisk, buildProjectsCommandWhere<ProjectRisk>(ctx, { id }))
  if (!record) return null
  ensureProjectsCommandScope(ctx, record)
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    projectId: record.projectId,
    title: record.title,
    description: record.description ?? null,
    riskType: record.riskType,
    status: record.status,
    ownerEmployeeId: record.ownerEmployeeId ?? null,
    isActive: !!record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createRiskCommand: CommandHandler<RiskCreateInput, { riskId: string }> = {
  id: 'projects.risks.create',
  async execute(input, ctx) {
    const parsed = riskCreateSchema.parse(input)
    ensureProjectsCommandScope(ctx, parsed)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    await assertProjectInScope(em, ctx, parsed.projectId)

    const now = new Date()
    const record = em.create(ProjectRisk, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      projectId: parsed.projectId,
      title: parsed.title,
      description: parsed.description ?? null,
      riskType: parsed.riskType ?? 'other',
      status: parsed.status ?? 'open',
      ownerEmployeeId: parsed.ownerEmployeeId ?? null,
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await withAtomicFlush(em, [() => undefined], { transaction: true, label: 'projects.risks.create' })

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
      events: riskCrudEvents,
    })
    return { riskId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadRiskSnapshot(em, result.riskId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as RiskSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('projects.audit.riskCreate', 'Create project risk'),
      resourceKind: 'projects.project_risk',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<RiskUndoPayload>(logEntry)
    const after = payload?.after ?? null
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectRisk, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()
  },
  redo: makeCreateRedo<ProjectRisk, RiskSnapshot, RiskCreateInput, { riskId: string }>({
    entityClass: ProjectRisk,
    buildResult: (entity) => ({ riskId: entity.id }),
    events: riskCrudEvents,
  }),
}

const updateRiskCommand: CommandHandler<RiskUpdateInput, { riskId: string }> = {
  id: 'projects.risks.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Risk ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    return { before: await loadRiskSnapshot(em, input.id, ctx) }
  },
  async execute(input, ctx) {
    const parsed = riskUpdateSchema.parse(input)
    requireId(parsed.id, 'Risk ID is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectRisk, buildProjectsCommandWhere<ProjectRisk>(ctx, { id: parsed.id }))
    if (!record) throw new CrudHttpError(404, { error: 'Risk not found' })
    ensureProjectsCommandScope(ctx, record)
    if (parsed.projectId) await assertProjectInScope(em, ctx, parsed.projectId)

    const allChanges = buildChanges(record as unknown as Record<string, unknown>, parsed, [...RISK_FIELDS])
    const changes = Object.fromEntries(
      Object.entries(allChanges).filter(([, c]) => c.to !== undefined),
    ) as Record<string, { from: unknown; to: unknown }>
    if (Object.keys(changes).length === 0) return { riskId: record.id }

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
      { transaction: true, label: 'projects.risks.update' },
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
      events: riskCrudEvents,
    })
    return { riskId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadRiskSnapshot(em, result.riskId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as RiskSnapshot | undefined
    const after = snapshots.after as RiskSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('projects.audit.riskUpdate', 'Update project risk'),
      resourceKind: 'projects.project_risk',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? undefined,
      snapshotAfter: after,
      payload: { undo: { before, after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<RiskUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectRisk, { id: before.id })
    if (!record) return
    Object.assign(record, {
      projectId: before.projectId,
      title: before.title,
      description: before.description,
      riskType: before.riskType,
      status: before.status,
      ownerEmployeeId: before.ownerEmployeeId,
      isActive: before.isActive,
      updatedAt: new Date(),
    })
    await em.flush()
  },
}

const deleteRiskCommand: CommandHandler<RiskDeleteInput, { riskId: string }> = {
  id: 'projects.risks.delete',
  async prepare(input, ctx) {
    requireId(input.id, 'Risk ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    return { before: await loadRiskSnapshot(em, input.id, ctx) }
  },
  async execute(input, ctx) {
    const parsed = riskDeleteSchema.parse(input)
    requireId(parsed.id, 'Risk ID is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectRisk, buildProjectsCommandWhere<ProjectRisk>(ctx, { id: parsed.id }))
    if (!record) throw new CrudHttpError(404, { error: 'Risk not found' })
    ensureProjectsCommandScope(ctx, record)
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
      events: riskCrudEvents,
    })
    return { riskId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as RiskSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('projects.audit.riskDelete', 'Delete project risk'),
      resourceKind: 'projects.project_risk',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<RiskUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectRisk, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.isActive = before.isActive
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createRiskCommand)
registerCommand(updateRiskCommand)
registerCommand(deleteRiskCommand)

export { createRiskCommand, updateRiskCommand, deleteRiskCommand }
