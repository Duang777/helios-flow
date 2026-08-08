import { registerCommand } from '@helios/shared/lib/commands'
import type { CommandHandler } from '@helios/shared/lib/commands'
import { buildChanges, requireId, emitCrudSideEffects } from '@helios/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@helios/shared/lib/commands/undo'
import { makeCreateRedo } from '@helios/shared/lib/commands/redo'
import { withAtomicFlush } from '@helios/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@helios/shared/lib/crud/errors'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { CustomerEntity } from '../../customers/data/entities'
import { CustomerIdentityMap } from '../data/entities'
import {
  identityMapCreateSchema,
  identityMapUpdateSchema,
  identityMapDeleteSchema,
  type IdentityMapCreateInput,
  type IdentityMapUpdateInput,
  type IdentityMapDeleteInput,
} from '../data/validators'
import type { CrudEventsConfig } from '@helios/shared/lib/crud/types'
import type { DataEngine } from '@helios/shared/lib/data/engine'
import { buildGovernanceCommandWhere, ensureGovernanceCommandScope } from './scope'

const identityMapCrudEvents: CrudEventsConfig = {
  module: 'governance',
  entity: 'identity_map',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type IdentityMapSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  sourceEntityId: string
  sourceCustomerCode: string | null
  canonicalEntityId: string
  canonicalCustomerCode: string | null
  rationale: string
  status: string
  isSimulation: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type IdentityMapUndoPayload = UndoPayload<IdentityMapSnapshot>

const IDENTITY_MAP_FIELDS = [
  'sourceEntityId',
  'sourceCustomerCode',
  'canonicalEntityId',
  'canonicalCustomerCode',
  'rationale',
  'status',
  'isSimulation',
  'isActive',
] as const

async function assertCustomerEntityExists(
  em: EntityManager,
  ctx: Parameters<typeof buildGovernanceCommandWhere>[0],
  entityId: string,
  label: string,
): Promise<void> {
  const entity = await em.findOne(
    CustomerEntity,
    buildGovernanceCommandWhere<CustomerEntity>(ctx, { id: entityId, deletedAt: null }),
  )
  if (!entity) {
    throw new CrudHttpError(404, { error: `${label} customer entity not found` })
  }
}

async function loadIdentityMapSnapshot(
  em: EntityManager,
  id: string,
  ctx: Parameters<typeof buildGovernanceCommandWhere>[0],
): Promise<IdentityMapSnapshot | null> {
  const record = await em.findOne(
    CustomerIdentityMap,
    buildGovernanceCommandWhere<CustomerIdentityMap>(ctx, { id }),
  )
  if (!record) return null
  ensureGovernanceCommandScope(ctx, record)
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    sourceEntityId: record.sourceEntityId,
    sourceCustomerCode: record.sourceCustomerCode ?? null,
    canonicalEntityId: record.canonicalEntityId,
    canonicalCustomerCode: record.canonicalCustomerCode ?? null,
    rationale: record.rationale,
    status: record.status,
    isSimulation: !!record.isSimulation,
    isActive: !!record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createIdentityMapCommand: CommandHandler<
  IdentityMapCreateInput,
  { identityMapId: string }
> = {
  id: 'governance.identity_maps.create',
  async execute(input, ctx) {
    const parsed = identityMapCreateSchema.parse(input)
    ensureGovernanceCommandScope(ctx, parsed)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    await assertCustomerEntityExists(em, ctx, parsed.sourceEntityId, 'Source')
    await assertCustomerEntityExists(em, ctx, parsed.canonicalEntityId, 'Canonical')

    const now = new Date()
    const record = em.create(CustomerIdentityMap, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      sourceEntityId: parsed.sourceEntityId,
      sourceCustomerCode: parsed.sourceCustomerCode ?? null,
      canonicalEntityId: parsed.canonicalEntityId,
      canonicalCustomerCode: parsed.canonicalCustomerCode ?? null,
      rationale: parsed.rationale,
      status: parsed.status ?? 'active',
      isSimulation: parsed.isSimulation === true,
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await withAtomicFlush(em, [() => undefined], {
      transaction: true,
      label: 'governance.identity_maps.create',
    })

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
      events: identityMapCrudEvents,
    })

    return { identityMapId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadIdentityMapSnapshot(em, result.identityMapId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as IdentityMapSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('governance.audit.identityMapCreate', 'Create identity map'),
      resourceKind: 'governance.identity_map',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<IdentityMapUndoPayload>(logEntry)
    const after = payload?.after ?? null
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CustomerIdentityMap, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()
  },
  redo: makeCreateRedo<
    CustomerIdentityMap,
    IdentityMapSnapshot,
    IdentityMapCreateInput,
    { identityMapId: string }
  >({
    entityClass: CustomerIdentityMap,
    buildResult: (entity) => ({ identityMapId: entity.id }),
    events: identityMapCrudEvents,
  }),
}

const updateIdentityMapCommand: CommandHandler<
  IdentityMapUpdateInput,
  { identityMapId: string }
> = {
  id: 'governance.identity_maps.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Identity map ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadIdentityMapSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = identityMapUpdateSchema.parse(input)
    requireId(parsed.id, 'Identity map ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      CustomerIdentityMap,
      buildGovernanceCommandWhere<CustomerIdentityMap>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Identity map not found' })
    ensureGovernanceCommandScope(ctx, record)

    if (parsed.sourceEntityId) {
      await assertCustomerEntityExists(em, ctx, parsed.sourceEntityId, 'Source')
    }
    if (parsed.canonicalEntityId) {
      await assertCustomerEntityExists(em, ctx, parsed.canonicalEntityId, 'Canonical')
    }

    const allChanges = buildChanges(
      record as unknown as Record<string, unknown>,
      parsed,
      [...IDENTITY_MAP_FIELDS],
    )
    const changes = Object.fromEntries(
      Object.entries(allChanges).filter(([, change]) => change.to !== undefined),
    ) as Record<string, { from: unknown; to: unknown }>

    if (Object.keys(changes).length === 0) return { identityMapId: record.id }

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
      { transaction: true, label: 'governance.identity_maps.update' },
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
      events: identityMapCrudEvents,
    })

    return { identityMapId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadIdentityMapSnapshot(em, result.identityMapId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as IdentityMapSnapshot | undefined
    const after = snapshots.after as IdentityMapSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('governance.audit.identityMapUpdate', 'Update identity map'),
      resourceKind: 'governance.identity_map',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? undefined,
      snapshotAfter: after,
      payload: { undo: { before, after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<IdentityMapUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CustomerIdentityMap, { id: before.id })
    if (!record) return
    Object.assign(record, {
      sourceEntityId: before.sourceEntityId,
      sourceCustomerCode: before.sourceCustomerCode,
      canonicalEntityId: before.canonicalEntityId,
      canonicalCustomerCode: before.canonicalCustomerCode,
      rationale: before.rationale,
      status: before.status,
      isSimulation: before.isSimulation,
      isActive: before.isActive,
      updatedAt: new Date(),
    })
    await em.flush()
  },
}

const deleteIdentityMapCommand: CommandHandler<
  IdentityMapDeleteInput,
  { identityMapId: string }
> = {
  id: 'governance.identity_maps.delete',
  async prepare(input, ctx) {
    requireId(input.id, 'Identity map ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadIdentityMapSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = identityMapDeleteSchema.parse(input)
    requireId(parsed.id, 'Identity map ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      CustomerIdentityMap,
      buildGovernanceCommandWhere<CustomerIdentityMap>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Identity map not found' })
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
      events: identityMapCrudEvents,
    })

    return { identityMapId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as IdentityMapSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('governance.audit.identityMapDelete', 'Delete identity map'),
      resourceKind: 'governance.identity_map',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<IdentityMapUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CustomerIdentityMap, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.isActive = before.isActive
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createIdentityMapCommand)
registerCommand(updateIdentityMapCommand)
registerCommand(deleteIdentityMapCommand)

export { createIdentityMapCommand, updateIdentityMapCommand, deleteIdentityMapCommand }
