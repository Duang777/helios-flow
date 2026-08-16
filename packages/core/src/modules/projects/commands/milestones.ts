import { registerCommand } from '@helios/shared/lib/commands'
import type { CommandHandler } from '@helios/shared/lib/commands'
import { buildChanges, requireId, emitCrudSideEffects } from '@helios/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@helios/shared/lib/commands/undo'
import { makeCreateRedo } from '@helios/shared/lib/commands/redo'
import { withAtomicFlush } from '@helios/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@helios/shared/lib/crud/errors'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { Project, ProjectMilestone } from '../data/entities'
import {
  milestoneCreateSchema,
  milestoneUpdateSchema,
  milestoneDeleteSchema,
  type MilestoneCreateInput,
  type MilestoneUpdateInput,
  type MilestoneDeleteInput,
} from '../data/validators'
import type { CrudEventsConfig } from '@helios/shared/lib/crud/types'
import type { DataEngine } from '@helios/shared/lib/data/engine'
import { buildProjectsCommandWhere, ensureProjectsCommandScope } from './scope'

const milestoneCrudEvents: CrudEventsConfig = {
  module: 'projects',
  entity: 'project_milestone',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type MilestoneSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  projectId: string
  name: string
  status: string
  plannedDate: string | null
  actualDate: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type MilestoneUndoPayload = UndoPayload<MilestoneSnapshot>

const MILESTONE_FIELDS = ['projectId', 'name', 'status', 'plannedDate', 'actualDate', 'sortOrder', 'isActive'] as const

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

async function loadMilestoneSnapshot(
  em: EntityManager,
  id: string,
  ctx: Parameters<typeof buildProjectsCommandWhere>[0],
): Promise<MilestoneSnapshot | null> {
  const record = await em.findOne(ProjectMilestone, buildProjectsCommandWhere<ProjectMilestone>(ctx, { id }))
  if (!record) return null
  ensureProjectsCommandScope(ctx, record)
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    projectId: record.projectId,
    name: record.name,
    status: record.status,
    plannedDate: record.plannedDate ?? null,
    actualDate: record.actualDate ?? null,
    sortOrder: record.sortOrder,
    isActive: !!record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createMilestoneCommand: CommandHandler<MilestoneCreateInput, { milestoneId: string }> = {
  id: 'projects.milestones.create',
  async execute(input, ctx) {
    const parsed = milestoneCreateSchema.parse(input)
    ensureProjectsCommandScope(ctx, parsed)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    await assertProjectInScope(em, ctx, parsed.projectId)

    const now = new Date()
    const record = em.create(ProjectMilestone, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      projectId: parsed.projectId,
      name: parsed.name,
      status: parsed.status ?? 'planned',
      plannedDate: parsed.plannedDate ?? null,
      actualDate: parsed.actualDate ?? null,
      sortOrder: parsed.sortOrder ?? 0,
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await withAtomicFlush(em, [() => undefined], { transaction: true, label: 'projects.milestones.create' })

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
      events: milestoneCrudEvents,
    })
    return { milestoneId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadMilestoneSnapshot(em, result.milestoneId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as MilestoneSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('projects.audit.milestoneCreate', 'Create milestone'),
      resourceKind: 'projects.project_milestone',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<MilestoneUndoPayload>(logEntry)
    const after = payload?.after ?? null
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectMilestone, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()
  },
  redo: makeCreateRedo<ProjectMilestone, MilestoneSnapshot, MilestoneCreateInput, { milestoneId: string }>({
    entityClass: ProjectMilestone,
    buildResult: (entity) => ({ milestoneId: entity.id }),
    events: milestoneCrudEvents,
  }),
}

const updateMilestoneCommand: CommandHandler<MilestoneUpdateInput, { milestoneId: string }> = {
  id: 'projects.milestones.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Milestone ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    return { before: await loadMilestoneSnapshot(em, input.id, ctx) }
  },
  async execute(input, ctx) {
    const parsed = milestoneUpdateSchema.parse(input)
    requireId(parsed.id, 'Milestone ID is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      ProjectMilestone,
      buildProjectsCommandWhere<ProjectMilestone>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Milestone not found' })
    ensureProjectsCommandScope(ctx, record)
    if (parsed.projectId) await assertProjectInScope(em, ctx, parsed.projectId)

    const allChanges = buildChanges(record as unknown as Record<string, unknown>, parsed, [...MILESTONE_FIELDS])
    const changes = Object.fromEntries(
      Object.entries(allChanges).filter(([, c]) => c.to !== undefined),
    ) as Record<string, { from: unknown; to: unknown }>
    if (Object.keys(changes).length === 0) return { milestoneId: record.id }

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
      { transaction: true, label: 'projects.milestones.update' },
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
      events: milestoneCrudEvents,
    })
    return { milestoneId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadMilestoneSnapshot(em, result.milestoneId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as MilestoneSnapshot | undefined
    const after = snapshots.after as MilestoneSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('projects.audit.milestoneUpdate', 'Update milestone'),
      resourceKind: 'projects.project_milestone',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? undefined,
      snapshotAfter: after,
      payload: { undo: { before, after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<MilestoneUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectMilestone, { id: before.id })
    if (!record) return
    Object.assign(record, {
      projectId: before.projectId,
      name: before.name,
      status: before.status,
      plannedDate: before.plannedDate,
      actualDate: before.actualDate,
      sortOrder: before.sortOrder,
      isActive: before.isActive,
      updatedAt: new Date(),
    })
    await em.flush()
  },
}

const deleteMilestoneCommand: CommandHandler<MilestoneDeleteInput, { milestoneId: string }> = {
  id: 'projects.milestones.delete',
  async prepare(input, ctx) {
    requireId(input.id, 'Milestone ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    return { before: await loadMilestoneSnapshot(em, input.id, ctx) }
  },
  async execute(input, ctx) {
    const parsed = milestoneDeleteSchema.parse(input)
    requireId(parsed.id, 'Milestone ID is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      ProjectMilestone,
      buildProjectsCommandWhere<ProjectMilestone>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Milestone not found' })
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
      events: milestoneCrudEvents,
    })
    return { milestoneId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as MilestoneSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('projects.audit.milestoneDelete', 'Delete milestone'),
      resourceKind: 'projects.project_milestone',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<MilestoneUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProjectMilestone, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.isActive = before.isActive
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createMilestoneCommand)
registerCommand(updateMilestoneCommand)
registerCommand(deleteMilestoneCommand)

export { createMilestoneCommand, updateMilestoneCommand, deleteMilestoneCommand }
