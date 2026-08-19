import { registerCommand } from '@helios/shared/lib/commands'
import type { CommandHandler } from '@helios/shared/lib/commands'
import { buildChanges, requireId, emitCrudSideEffects } from '@helios/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@helios/shared/lib/commands/undo'
import { makeCreateRedo } from '@helios/shared/lib/commands/redo'
import { withAtomicFlush } from '@helios/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@helios/shared/lib/crud/errors'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { CommercialContract } from '../data/entities'
import {
  contractCreateSchema,
  contractUpdateSchema,
  contractDeleteSchema,
  type ContractCreateInput,
  type ContractUpdateInput,
  type ContractDeleteInput,
} from '../data/validators'
import type { CrudEventsConfig } from '@helios/shared/lib/crud/types'
import type { DataEngine } from '@helios/shared/lib/data/engine'
import { buildCommercialCommandWhere, ensureCommercialCommandScope } from './scope'

const contractCrudEvents: CrudEventsConfig = {
  module: 'commercial',
  entity: 'contract',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type ContractSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  name: string
  code: string | null
  status: string
  contractType: string
  customerEntityId: string | null
  projectId: string | null
  dealId: string | null
  amount: string
  currencyCode: string
  startDate: string | null
  endDate: string | null
  paymentTerms: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type ContractUndoPayload = UndoPayload<ContractSnapshot>

const CONTRACT_FIELDS = [
  'name',
  'code',
  'status',
  'contractType',
  'customerEntityId',
  'projectId',
  'dealId',
  'amount',
  'currencyCode',
  'startDate',
  'endDate',
  'paymentTerms',
  'isActive',
] as const

async function loadContractSnapshot(
  em: EntityManager,
  id: string,
  ctx: Parameters<typeof buildCommercialCommandWhere>[0],
): Promise<ContractSnapshot | null> {
  const record = await em.findOne(CommercialContract, buildCommercialCommandWhere<CommercialContract>(ctx, { id }))
  if (!record) return null
  ensureCommercialCommandScope(ctx, record)
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    name: record.name,
    code: record.code ?? null,
    status: record.status,
    contractType: record.contractType,
    customerEntityId: record.customerEntityId ?? null,
    projectId: record.projectId ?? null,
    dealId: record.dealId ?? null,
    amount: record.amount,
    currencyCode: record.currencyCode,
    startDate: record.startDate ?? null,
    endDate: record.endDate ?? null,
    paymentTerms: record.paymentTerms ?? null,
    isActive: !!record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createContractCommand: CommandHandler<ContractCreateInput, { contractId: string }> = {
  id: 'commercial.contracts.create',
  async execute(input, ctx) {
    const parsed = contractCreateSchema.parse(input)
    ensureCommercialCommandScope(ctx, parsed)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(CommercialContract, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      name: parsed.name,
      code: parsed.code ?? null,
      status: parsed.status ?? 'draft',
      contractType: parsed.contractType ?? 'sales',
      customerEntityId: parsed.customerEntityId ?? null,
      projectId: parsed.projectId ?? null,
      dealId: parsed.dealId ?? null,
      amount: parsed.amount,
      currencyCode: parsed.currencyCode ?? 'CNY',
      startDate: parsed.startDate ?? null,
      endDate: parsed.endDate ?? null,
      paymentTerms: parsed.paymentTerms ?? null,
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await withAtomicFlush(em, [() => undefined], { transaction: true, label: 'commercial.contracts.create' })

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
      events: contractCrudEvents,
    })

    return { contractId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadContractSnapshot(em, result.contractId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as ContractSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.contractCreate', 'Create contract'),
      resourceKind: 'commercial.contract',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ContractUndoPayload>(logEntry)
    const after = payload?.after ?? null
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CommercialContract, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()
  },
  redo: makeCreateRedo<CommercialContract, ContractSnapshot, ContractCreateInput, { contractId: string }>({
    entityClass: CommercialContract,
    buildResult: (entity) => ({ contractId: entity.id }),
    events: contractCrudEvents,
  }),
}

const updateContractCommand: CommandHandler<ContractUpdateInput, { contractId: string }> = {
  id: 'commercial.contracts.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Contract ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadContractSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = contractUpdateSchema.parse(input)
    requireId(parsed.id, 'Contract ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      CommercialContract,
      buildCommercialCommandWhere<CommercialContract>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Contract not found' })
    ensureCommercialCommandScope(ctx, record)

    const allChanges = buildChanges(record as unknown as Record<string, unknown>, parsed, [...CONTRACT_FIELDS])
    const changes = Object.fromEntries(
      Object.entries(allChanges).filter(([, change]) => change.to !== undefined),
    ) as Record<string, { from: unknown; to: unknown }>

    if (Object.keys(changes).length === 0) return { contractId: record.id }

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
      { transaction: true, label: 'commercial.contracts.update' },
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
      events: contractCrudEvents,
    })

    return { contractId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadContractSnapshot(em, result.contractId, ctx)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as ContractSnapshot | undefined
    const after = snapshots.after as ContractSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.contractUpdate', 'Update contract'),
      resourceKind: 'commercial.contract',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? undefined,
      snapshotAfter: after,
      payload: { undo: { before, after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ContractUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CommercialContract, { id: before.id })
    if (!record) return
    Object.assign(record, {
      name: before.name,
      code: before.code,
      status: before.status,
      contractType: before.contractType,
      customerEntityId: before.customerEntityId,
      projectId: before.projectId,
      dealId: before.dealId,
      amount: before.amount,
      currencyCode: before.currencyCode,
      startDate: before.startDate,
      endDate: before.endDate,
      paymentTerms: before.paymentTerms,
      isActive: before.isActive,
      updatedAt: new Date(),
    })
    await em.flush()
  },
}

const deleteContractCommand: CommandHandler<ContractDeleteInput, { contractId: string }> = {
  id: 'commercial.contracts.delete',
  async prepare(input, ctx) {
    requireId(input.id, 'Contract ID is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadContractSnapshot(em, input.id, ctx)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = contractDeleteSchema.parse(input)
    requireId(parsed.id, 'Contract ID is required')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      CommercialContract,
      buildCommercialCommandWhere<CommercialContract>(ctx, { id: parsed.id }),
    )
    if (!record) throw new CrudHttpError(404, { error: 'Contract not found' })
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
      events: contractCrudEvents,
    })

    return { contractId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as ContractSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('commercial.audit.contractDelete', 'Delete contract'),
      resourceKind: 'commercial.contract',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ContractUndoPayload>(logEntry)
    const before = payload?.before ?? null
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CommercialContract, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.isActive = before.isActive
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createContractCommand)
registerCommand(updateContractCommand)
registerCommand(deleteContractCommand)

export { createContractCommand, updateContractCommand, deleteContractCommand }
