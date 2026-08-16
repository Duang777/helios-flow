import { registerCommand } from '@helios/shared/lib/commands'
import type { CommandHandler } from '@helios/shared/lib/commands'
import { buildChanges, requireId, emitCrudSideEffects } from '@helios/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@helios/shared/lib/commands/undo'
import { makeCreateRedo } from '@helios/shared/lib/commands/redo'
import { withAtomicFlush } from '@helios/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@helios/shared/lib/crud/errors'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { Project } from '../data/entities'
import {
  projectCreateSchema,
  projectUpdateSchema,
  projectDeleteSchema,
  type ProjectCreateInput,
  type ProjectUpdateInput,
  type ProjectDeleteInput,
} from '../data/validators'
import type { CrudEventsConfig } from '@helios/shared/lib/crud/types'
import type { DataEngine } from '@helios/shared/lib/data/engine'
import { buildProjectsCommandWhere, ensureProjectsCommandScope } from './scope'

const projectCrudEvents: CrudEventsConfig = {
  module: 'projects',
  entity: 'project',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type ProjectSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  name: string
  code: string | null
  status: string
  customerEntityId: string | null
  dealId: string | null
  projectManagerId: string | null
  productLineCode: string | null
  bizCategory: string | null
  budgetRevenue: string | null
  budgetCost: string | null
  forecastRevenue: string | null
  forecastCost: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type ProjectUndoPayload = UndoPayload<ProjectSnapshot>

const PROJECT_FIELDS = [
  'name',
  'code',
  'status',
  'customerEntityId',
  'dealId',
  'projectManagerId',
  'productLineCode',
  'bizCategory',
  'budgetRevenue',
  'budgetCost',
  'forecastRevenue',
  'forecastCost',
  'isActive',
] as const

async function loadProjectSnapshot(
  em: EntityManager,
  id: string,
  ctx: Parameters<typeof buildProjectsCommandWhere>[0],
): Promise<ProjectSnapshot | null> {
  const record = await em.findOne(Project, buildProjectsCommandWhere<Project>(ctx, { id }))
  if (!record) return null
  ensureProjectsCommandScope(ctx, record)
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    name: record.name,
    code: record.code ?? null,
    status: record.status,
    customerEntityId: record.customerEntityId ?? null,
    dealId: record.dealId ?? null,
    projectManagerId: record.projectManagerId ?? null,
    productLineCode: record.productLineCode ?? null,
    bizCategory: record.bizCategory ?? null,
    budgetRevenue: record.budgetRevenue ?? null,
    budgetCost: record.budgetCost ?? null,
    forecastRevenue: record.forecastRevenue ?? null,
    forecastCost: record.forecastCost ?? null,
    isActive: !!record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createProjectCommand: CommandHandler<ProjectCreateInput, { projectId: string }> = {
  id: 'projects.projects.create',
  async execute(input, ctx) {
    const parsed = projectCreateSchema.parse(input)
    ensureProjectsCommandScope(ctx, parsed)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(Project, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      name: parsed.name,
      code: parsed.code ?? null,
      status: parsed.status ?? 'draft',
      customerEntityId: parsed.customerEntityId ?? null,
      dealId: parsed.dealId ?? null,
      projectManagerId: parsed.projectManagerId ?? null,
      productLineCode: parsed.productLineCode ?? null,
      bizCategory: parsed.bizCategory ?? null,
      budgetRevenue: parsed.budgetRevenue ?? null,
      budgetCost: parsed.budgetCost ?? null,
      forecastRevenue: parsed.forecastRevenue ?? null,
      forecastCost: parsed.forecastCost ?? null,
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await withAtomicFlush(em, [() => undefined], { transaction: true, label: 'projects.projects.create' })

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
      events: projectCrudEvents,
    })

    return { projectId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadProjectSnapshot(em, result.projectId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as ProjectSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('projects.audit.create', 'Create project'),
      resourceKind: 'projects.project',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ProjectUndoPayload>(logEntry)
    const after = payload?.after ?? null
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(Project, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()
  },
  redo: makeCreateRedo<Project, ProjectSnapshot, ProjectCreateInput, { projectId: string }>({
    entityClass: Project,
    buildResult: (entity) => ({ projectId: entity.id }),
    events: projectCrudEvents,
  }),
}

const updateProjectCommand: CommandHandler<ProjectUpdateInput, { projectId: string }> = {
  id: 'projects.projects.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Project ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadProjectSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = projectUpdateSchema.parse(input)
    requireId(parsed.id, 'Project ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(Project, buildProjectsCommandWhere<Project>(ctx, { id: parsed.id }))
    if (!record) throw new CrudHttpError(404, { error: 'Project not found' })
    ensureProjectsCommandScope(ctx, record)

    const allChanges = buildChanges(record as unknown as Record<string, unknown>, parsed, [...PROJECT_FIELDS])
    const changes = Object.fromEntries(
      Object.entries(allChanges).filter(([, c]) => c.to !== undefined),
    ) as Record<string, { from: unknown; to: unknown }>

    if (Object.keys(changes).length === 0) return { projectId: record.id }

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
      { transaction: true, label: 'projects.projects.update' },
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
      events: projectCrudEvents,
    })

    return { projectId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadProjectSnapshot(em, result.projectId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as ProjectSnapshot | undefined
    const after = snapshots.after as ProjectSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('projects.audit.update', 'Update project'),
      resourceKind: 'projects.project',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? undefined,
      snapshotAfter: after,
      payload: { undo: { before, after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ProjectUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(Project, { id: before.id })
    if (!record) return
    Object.assign(record, {
      name: before.name,
      code: before.code,
      status: before.status,
      customerEntityId: before.customerEntityId,
      dealId: before.dealId,
      projectManagerId: before.projectManagerId,
      productLineCode: before.productLineCode,
      bizCategory: before.bizCategory,
      budgetRevenue: before.budgetRevenue,
      budgetCost: before.budgetCost,
      forecastRevenue: before.forecastRevenue,
      forecastCost: before.forecastCost,
      isActive: before.isActive,
      updatedAt: new Date(),
    })
    await em.flush()
  },
}

const deleteProjectCommand: CommandHandler<ProjectDeleteInput, { projectId: string }> = {
  id: 'projects.projects.delete',
  async prepare(input, ctx) {
    requireId(input.id, 'Project ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadProjectSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = projectDeleteSchema.parse(input)
    requireId(parsed.id, 'Project ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(Project, buildProjectsCommandWhere<Project>(ctx, { id: parsed.id }))
    if (!record) throw new CrudHttpError(404, { error: 'Project not found' })
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
      events: projectCrudEvents,
    })

    return { projectId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as ProjectSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('projects.audit.delete', 'Delete project'),
      resourceKind: 'projects.project',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ProjectUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(Project, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.isActive = before.isActive
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createProjectCommand)
registerCommand(updateProjectCommand)
registerCommand(deleteProjectCommand)

export { createProjectCommand, updateProjectCommand, deleteProjectCommand }
