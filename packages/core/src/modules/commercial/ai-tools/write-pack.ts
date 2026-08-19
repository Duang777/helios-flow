import type { EntityManager } from '@mikro-orm/postgresql'
import { defineAiTool } from '@helios/ai-assistant'
import { createAiApiOperationRunner } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolExecutionContext } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolLoadBeforeSingleRecord } from '@helios/ai-assistant/modules/ai_assistant/lib/types'
import { z } from 'zod'
import { CommercialContract, CommercialInvoice, CommercialPayment, PaymentAllocation } from '../data/entities'
import { assertAllocationWithinLimits } from '../lib/allocationGuards'
import { assertTenantScope, type CommercialAiToolDefinition, type CommercialToolContext } from './types'

type ManageContractInput = z.infer<typeof manageContractInput>
type ManageInvoiceInput = z.infer<typeof manageInvoiceInput>
type ManagePaymentInput = z.infer<typeof managePaymentInput>
type ManageAllocationInput = z.infer<typeof manageAllocationInput>

function resolveEm(ctx: CommercialToolContext | AiToolExecutionContext): EntityManager {
  return ctx.container.resolve<EntityManager>('em')
}

function recordVersionFromUpdatedAt(updatedAt: Date | null | undefined): string | null {
  return updatedAt ? updatedAt.toISOString() : null
}

function contractSnapshot(row: CommercialContract): Record<string, unknown> {
  return {
    name: row.name,
    code: row.code ?? null,
    status: row.status,
    contractType: row.contractType,
    customerEntityId: row.customerEntityId ?? null,
    projectId: row.projectId ?? null,
    dealId: row.dealId ?? null,
    amount: row.amount,
    currencyCode: row.currencyCode,
    startDate: row.startDate ?? null,
    endDate: row.endDate ?? null,
    paymentTerms: row.paymentTerms ?? null,
    isActive: !!row.isActive,
  }
}

function invoiceSnapshot(row: CommercialInvoice): Record<string, unknown> {
  return {
    contractId: row.contractId ?? null,
    projectId: row.projectId ?? null,
    customerEntityId: row.customerEntityId ?? null,
    invoiceNo: row.invoiceNo ?? null,
    status: row.status,
    amount: row.amount,
    currencyCode: row.currencyCode,
    issuedOn: row.issuedOn,
    dueDate: row.dueDate ?? null,
    isActive: !!row.isActive,
  }
}

function paymentSnapshot(row: CommercialPayment): Record<string, unknown> {
  return {
    customerEntityId: row.customerEntityId ?? null,
    paymentNo: row.paymentNo ?? null,
    status: row.status,
    amount: row.amount,
    currencyCode: row.currencyCode,
    paidOn: row.paidOn,
    isActive: !!row.isActive,
  }
}

function allocationSnapshot(row: PaymentAllocation): Record<string, unknown> {
  return {
    invoiceId: row.invoiceId,
    paymentId: row.paymentId,
    allocatedAmount: row.allocatedAmount,
    allocatedOn: row.allocatedOn ?? null,
    isActive: !!row.isActive,
  }
}

async function loadContractForScope(
  em: EntityManager,
  ctx: CommercialToolContext,
  tenantId: string,
  contractId: string,
): Promise<CommercialContract | null> {
  const row = await em.findOne(CommercialContract, {
    id: contractId,
    tenantId,
    organizationId: ctx.organizationId ?? undefined,
    deletedAt: null,
  })
  if (!row) return null
  if (ctx.organizationId && row.organizationId !== ctx.organizationId) return null
  return row
}

async function loadInvoiceForScope(
  em: EntityManager,
  ctx: CommercialToolContext,
  tenantId: string,
  invoiceId: string,
): Promise<CommercialInvoice | null> {
  const row = await em.findOne(CommercialInvoice, {
    id: invoiceId,
    tenantId,
    organizationId: ctx.organizationId ?? undefined,
    deletedAt: null,
  })
  if (!row) return null
  if (ctx.organizationId && row.organizationId !== ctx.organizationId) return null
  return row
}

async function loadPaymentForScope(
  em: EntityManager,
  ctx: CommercialToolContext,
  tenantId: string,
  paymentId: string,
): Promise<CommercialPayment | null> {
  const row = await em.findOne(CommercialPayment, {
    id: paymentId,
    tenantId,
    organizationId: ctx.organizationId ?? undefined,
    deletedAt: null,
  })
  if (!row) return null
  if (ctx.organizationId && row.organizationId !== ctx.organizationId) return null
  return row
}

async function loadAllocationForScope(
  em: EntityManager,
  ctx: CommercialToolContext,
  tenantId: string,
  allocationId: string,
): Promise<PaymentAllocation | null> {
  const row = await em.findOne(PaymentAllocation, {
    id: allocationId,
    tenantId,
    organizationId: ctx.organizationId ?? undefined,
    deletedAt: null,
  })
  if (!row) return null
  if (ctx.organizationId && row.organizationId !== ctx.organizationId) return null
  return row
}

function createPreview(
  recordId: string,
  entityType: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): AiToolLoadBeforeSingleRecord {
  return {
    recordId,
    entityType,
    recordVersion: null,
    before,
    after,
  }
}

const manageContractInput = z
  .object({
    operation: z.enum(['create', 'update']),
    contractId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    code: z.string().trim().max(64).nullable().optional(),
    status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
    contractType: z.enum(['sales', 'service', 'other']).optional(),
    customerEntityId: z.string().uuid().nullable().optional(),
    projectId: z.string().uuid().nullable().optional(),
    dealId: z.string().uuid().nullable().optional(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
    currencyCode: z.string().trim().max(8).optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    paymentTerms: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.operation === 'create') {
      if (!value.name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'name is required for create.', path: ['name'] })
      if (!value.amount) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'amount is required for create.', path: ['amount'] })
    }
    if (value.operation === 'update' && !value.contractId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'contractId is required for update.', path: ['contractId'] })
    }
  })

const manageInvoiceInput = z
  .object({
    operation: z.enum(['create', 'update']),
    invoiceId: z.string().uuid().optional(),
    contractId: z.string().uuid().nullable().optional(),
    projectId: z.string().uuid().nullable().optional(),
    customerEntityId: z.string().uuid().nullable().optional(),
    invoiceNo: z.string().trim().max(64).nullable().optional(),
    status: z.enum(['draft', 'issued', 'void']).optional(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
    currencyCode: z.string().trim().max(8).optional(),
    issuedOn: z.string().optional(),
    dueDate: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.operation === 'create') {
      if (!value.amount) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'amount is required for create.', path: ['amount'] })
      if (!value.issuedOn) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'issuedOn is required for create.', path: ['issuedOn'] })
    }
    if (value.operation === 'update' && !value.invoiceId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invoiceId is required for update.', path: ['invoiceId'] })
    }
  })

const managePaymentInput = z
  .object({
    operation: z.enum(['create', 'update']),
    paymentId: z.string().uuid().optional(),
    customerEntityId: z.string().uuid().nullable().optional(),
    paymentNo: z.string().trim().max(64).nullable().optional(),
    status: z.enum(['draft', 'posted', 'void']).optional(),
    amount: z.string().regex(/^\d+(\.\d+)?$/).optional(),
    currencyCode: z.string().trim().max(8).optional(),
    paidOn: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.operation === 'create') {
      if (!value.amount) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'amount is required for create.', path: ['amount'] })
      if (!value.paidOn) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'paidOn is required for create.', path: ['paidOn'] })
    }
    if (value.operation === 'update' && !value.paymentId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'paymentId is required for update.', path: ['paymentId'] })
    }
  })

const manageAllocationInput = z
  .object({
    operation: z.enum(['create', 'update']),
    allocationId: z.string().uuid().optional(),
    invoiceId: z.string().uuid().optional(),
    paymentId: z.string().uuid().optional(),
    allocatedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
    allocatedOn: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.operation === 'create') {
      if (!value.invoiceId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invoiceId is required for create.', path: ['invoiceId'] })
      if (!value.paymentId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'paymentId is required for create.', path: ['paymentId'] })
      if (!value.allocatedAmount) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'allocatedAmount is required for create.', path: ['allocatedAmount'] })
    }
    if (value.operation === 'update' && !value.allocationId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'allocationId is required for update.', path: ['allocationId'] })
    }
  })

async function loadContractPreview(
  input: ManageContractInput,
  ctx: CommercialToolContext,
): Promise<AiToolLoadBeforeSingleRecord | null> {
  const { tenantId } = assertTenantScope(ctx)
  const em = resolveEm(ctx)
  if (input.operation === 'create') {
    return createPreview(
      `create:${input.code ?? input.name}`,
      'commercial.contract',
      {
        name: null,
        code: null,
        status: null,
        contractType: null,
        customerEntityId: null,
        projectId: null,
        dealId: null,
        amount: null,
        currencyCode: null,
        startDate: null,
        endDate: null,
        paymentTerms: null,
        isActive: null,
      },
      {
        name: input.name ?? null,
        code: input.code ?? null,
        status: input.status ?? 'draft',
        contractType: input.contractType ?? 'sales',
        customerEntityId: input.customerEntityId ?? null,
        projectId: input.projectId ?? null,
        dealId: input.dealId ?? null,
        amount: input.amount ?? null,
        currencyCode: input.currencyCode ?? 'CNY',
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        paymentTerms: input.paymentTerms ?? null,
        isActive: input.isActive !== false,
      },
    )
  }
  const row = await loadContractForScope(em, ctx, tenantId, input.contractId!)
  if (!row) return null
  return {
    recordId: row.id,
    entityType: 'commercial.contract',
    recordVersion: recordVersionFromUpdatedAt(row.updatedAt),
    before: contractSnapshot(row),
  }
}

async function loadInvoicePreview(
  input: ManageInvoiceInput,
  ctx: CommercialToolContext,
): Promise<AiToolLoadBeforeSingleRecord | null> {
  const { tenantId } = assertTenantScope(ctx)
  const em = resolveEm(ctx)
  if (input.operation === 'create') {
    return createPreview(
      `create:${input.invoiceNo ?? input.contractId ?? input.projectId ?? 'invoice'}`,
      'commercial.invoice',
      {
        contractId: null,
        projectId: null,
        customerEntityId: null,
        invoiceNo: null,
        status: null,
        amount: null,
        currencyCode: null,
        issuedOn: null,
        dueDate: null,
        isActive: null,
      },
      {
        contractId: input.contractId ?? null,
        projectId: input.projectId ?? null,
        customerEntityId: input.customerEntityId ?? null,
        invoiceNo: input.invoiceNo ?? null,
        status: input.status ?? 'draft',
        amount: input.amount ?? null,
        currencyCode: input.currencyCode ?? 'CNY',
        issuedOn: input.issuedOn ?? null,
        dueDate: input.dueDate ?? null,
        isActive: input.isActive !== false,
      },
    )
  }
  const row = await loadInvoiceForScope(em, ctx, tenantId, input.invoiceId!)
  if (!row) return null
  return {
    recordId: row.id,
    entityType: 'commercial.invoice',
    recordVersion: recordVersionFromUpdatedAt(row.updatedAt),
    before: invoiceSnapshot(row),
  }
}

async function loadPaymentPreview(
  input: ManagePaymentInput,
  ctx: CommercialToolContext,
): Promise<AiToolLoadBeforeSingleRecord | null> {
  const { tenantId } = assertTenantScope(ctx)
  const em = resolveEm(ctx)
  if (input.operation === 'create') {
    return createPreview(
      `create:${input.paymentNo ?? input.customerEntityId ?? 'payment'}`,
      'commercial.payment',
      {
        customerEntityId: null,
        paymentNo: null,
        status: null,
        amount: null,
        currencyCode: null,
        paidOn: null,
        isActive: null,
      },
      {
        customerEntityId: input.customerEntityId ?? null,
        paymentNo: input.paymentNo ?? null,
        status: input.status ?? 'draft',
        amount: input.amount ?? null,
        currencyCode: input.currencyCode ?? 'CNY',
        paidOn: input.paidOn ?? null,
        isActive: input.isActive !== false,
      },
    )
  }
  const row = await loadPaymentForScope(em, ctx, tenantId, input.paymentId!)
  if (!row) return null
  return {
    recordId: row.id,
    entityType: 'commercial.payment',
    recordVersion: recordVersionFromUpdatedAt(row.updatedAt),
    before: paymentSnapshot(row),
  }
}

async function loadAllocationPreview(
  input: ManageAllocationInput,
  ctx: CommercialToolContext,
): Promise<AiToolLoadBeforeSingleRecord | null> {
  const { tenantId } = assertTenantScope(ctx)
  const em = resolveEm(ctx)
  if (input.operation === 'create') {
    return createPreview(
      `create:${input.invoiceId}:${input.paymentId}`,
      'commercial.payment_allocation',
      {
        invoiceId: null,
        paymentId: null,
        allocatedAmount: null,
        allocatedOn: null,
        isActive: null,
      },
      {
        invoiceId: input.invoiceId ?? null,
        paymentId: input.paymentId ?? null,
        allocatedAmount: input.allocatedAmount ?? null,
        allocatedOn: input.allocatedOn ?? null,
        isActive: input.isActive !== false,
      },
    )
  }
  const row = await loadAllocationForScope(em, ctx, tenantId, input.allocationId!)
  if (!row) return null
  return {
    recordId: row.id,
    entityType: 'commercial.payment_allocation',
    recordVersion: recordVersionFromUpdatedAt(row.updatedAt),
    before: allocationSnapshot(row),
  }
}

const manageContractTool = defineAiTool({
  name: 'commercial.manage_contract',
  displayName: 'Manage contract',
  description: 'Create or update an operating settlement contract with confirm-required approval.',
  inputSchema: manageContractInput,
  requiredFeatures: ['commercial.manage'],
  isMutation: true,
  loadBeforeRecord: loadContractPreview,
  async handler(rawInput: ManageContractInput, ctx: CommercialToolContext) {
    const { tenantId, organizationId } = assertTenantScope(ctx)
    const input = manageContractInput.parse(rawInput)
    const em = resolveEm(ctx)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)

    if (input.operation === 'create') {
      if (!organizationId) throw new Error('[internal] Organization scope is required to create a contract.')
      const response = await runner.run<{ id?: string }>({
        method: 'POST',
        path: '/commercial/contracts',
        body: {
          tenantId,
          organizationId,
          name: input.name,
          code: input.code ?? null,
          status: input.status,
          contractType: input.contractType,
          customerEntityId: input.customerEntityId ?? null,
          projectId: input.projectId ?? null,
          dealId: input.dealId ?? null,
          amount: input.amount,
          currencyCode: input.currencyCode ?? undefined,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
          paymentTerms: input.paymentTerms ?? null,
          isActive: input.isActive,
        },
      })
      if (!response.success) throw new Error(response.error ?? 'Failed to create contract')
      const contractId = typeof response.data?.id === 'string' ? response.data.id : null
      if (!contractId) throw new Error('Contract create succeeded without an id.')
      const after = await loadContractForScope(em, ctx as CommercialToolContext, tenantId, contractId)
      return { contractId, commandName: 'commercial.contracts.create', before: null, after: after ? contractSnapshot(after) : null }
    }

    const existing = await loadContractForScope(em, ctx as CommercialToolContext, tenantId, input.contractId!)
    if (!existing) throw new Error(`Contract "${input.contractId}" is not accessible to the caller.`)
    if (!organizationId) throw new Error('[internal] Organization scope is required to update a contract.')
    const body: Record<string, unknown> = { id: existing.id, tenantId, organizationId }
    if (input.name !== undefined) body.name = input.name
    if (input.code !== undefined) body.code = input.code
    if (input.status !== undefined) body.status = input.status
    if (input.contractType !== undefined) body.contractType = input.contractType
    if (input.customerEntityId !== undefined) body.customerEntityId = input.customerEntityId
    if (input.projectId !== undefined) body.projectId = input.projectId
    if (input.dealId !== undefined) body.dealId = input.dealId
    if (input.amount !== undefined) body.amount = input.amount
    if (input.currencyCode !== undefined) body.currencyCode = input.currencyCode
    if (input.startDate !== undefined) body.startDate = input.startDate
    if (input.endDate !== undefined) body.endDate = input.endDate
    if (input.paymentTerms !== undefined) body.paymentTerms = input.paymentTerms
    if (input.isActive !== undefined) body.isActive = input.isActive
    const response = await runner.run({ method: 'PUT', path: '/commercial/contracts', body })
    if (!response.success) throw new Error(response.error ?? `Failed to update contract "${existing.id}"`)
    const after = await loadContractForScope(em, ctx as CommercialToolContext, tenantId, existing.id)
    return { contractId: existing.id, commandName: 'commercial.contracts.update', before: contractSnapshot(existing), after: after ? contractSnapshot(after) : null }
  },
}) as CommercialAiToolDefinition

const manageInvoiceTool = defineAiTool({
  name: 'commercial.manage_invoice',
  displayName: 'Manage invoice',
  description: 'Create or update an operating invoice with confirm-required approval.',
  inputSchema: manageInvoiceInput,
  requiredFeatures: ['commercial.manage'],
  isMutation: true,
  loadBeforeRecord: loadInvoicePreview,
  async handler(rawInput: ManageInvoiceInput, ctx: CommercialToolContext) {
    const { tenantId, organizationId } = assertTenantScope(ctx)
    const input = manageInvoiceInput.parse(rawInput)
    const em = resolveEm(ctx)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)

    if (input.operation === 'create') {
      if (!organizationId) throw new Error('[internal] Organization scope is required to create an invoice.')
      const response = await runner.run<{ id?: string }>({
        method: 'POST',
        path: '/commercial/invoices',
        body: {
          tenantId,
          organizationId,
          contractId: input.contractId ?? null,
          projectId: input.projectId ?? null,
          customerEntityId: input.customerEntityId ?? null,
          invoiceNo: input.invoiceNo ?? null,
          status: input.status,
          amount: input.amount,
          currencyCode: input.currencyCode ?? undefined,
          issuedOn: input.issuedOn,
          dueDate: input.dueDate ?? null,
          isActive: input.isActive,
        },
      })
      if (!response.success) throw new Error(response.error ?? 'Failed to create invoice')
      const invoiceId = typeof response.data?.id === 'string' ? response.data.id : null
      if (!invoiceId) throw new Error('Invoice create succeeded without an id.')
      const after = await loadInvoiceForScope(em, ctx as CommercialToolContext, tenantId, invoiceId)
      return { invoiceId, commandName: 'commercial.invoices.create', before: null, after: after ? invoiceSnapshot(after) : null }
    }

    const existing = await loadInvoiceForScope(em, ctx as CommercialToolContext, tenantId, input.invoiceId!)
    if (!existing) throw new Error(`Invoice "${input.invoiceId}" is not accessible to the caller.`)
    if (!organizationId) throw new Error('[internal] Organization scope is required to update an invoice.')
    const body: Record<string, unknown> = { id: existing.id, tenantId, organizationId }
    if (input.contractId !== undefined) body.contractId = input.contractId
    if (input.projectId !== undefined) body.projectId = input.projectId
    if (input.customerEntityId !== undefined) body.customerEntityId = input.customerEntityId
    if (input.invoiceNo !== undefined) body.invoiceNo = input.invoiceNo
    if (input.status !== undefined) body.status = input.status
    if (input.amount !== undefined) body.amount = input.amount
    if (input.currencyCode !== undefined) body.currencyCode = input.currencyCode
    if (input.issuedOn !== undefined) body.issuedOn = input.issuedOn
    if (input.dueDate !== undefined) body.dueDate = input.dueDate
    if (input.isActive !== undefined) body.isActive = input.isActive
    const response = await runner.run({ method: 'PUT', path: '/commercial/invoices', body })
    if (!response.success) throw new Error(response.error ?? `Failed to update invoice "${existing.id}"`)
    const after = await loadInvoiceForScope(em, ctx as CommercialToolContext, tenantId, existing.id)
    return { invoiceId: existing.id, commandName: 'commercial.invoices.update', before: invoiceSnapshot(existing), after: after ? invoiceSnapshot(after) : null }
  },
}) as CommercialAiToolDefinition

const managePaymentTool = defineAiTool({
  name: 'commercial.manage_payment',
  displayName: 'Manage payment',
  description: 'Create or update an operating payment with confirm-required approval.',
  inputSchema: managePaymentInput,
  requiredFeatures: ['commercial.manage'],
  isMutation: true,
  loadBeforeRecord: loadPaymentPreview,
  async handler(rawInput: ManagePaymentInput, ctx: CommercialToolContext) {
    const { tenantId, organizationId } = assertTenantScope(ctx)
    const input = managePaymentInput.parse(rawInput)
    const em = resolveEm(ctx)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)

    if (input.operation === 'create') {
      if (!organizationId) throw new Error('[internal] Organization scope is required to create a payment.')
      const response = await runner.run<{ id?: string }>({
        method: 'POST',
        path: '/commercial/payments',
        body: {
          tenantId,
          organizationId,
          customerEntityId: input.customerEntityId ?? null,
          paymentNo: input.paymentNo ?? null,
          status: input.status,
          amount: input.amount,
          currencyCode: input.currencyCode ?? undefined,
          paidOn: input.paidOn,
          isActive: input.isActive,
        },
      })
      if (!response.success) throw new Error(response.error ?? 'Failed to create payment')
      const paymentId = typeof response.data?.id === 'string' ? response.data.id : null
      if (!paymentId) throw new Error('Payment create succeeded without an id.')
      const after = await loadPaymentForScope(em, ctx as CommercialToolContext, tenantId, paymentId)
      return { paymentId, commandName: 'commercial.payments.create', before: null, after: after ? paymentSnapshot(after) : null }
    }

    const existing = await loadPaymentForScope(em, ctx as CommercialToolContext, tenantId, input.paymentId!)
    if (!existing) throw new Error(`Payment "${input.paymentId}" is not accessible to the caller.`)
    if (!organizationId) throw new Error('[internal] Organization scope is required to update a payment.')
    const body: Record<string, unknown> = { id: existing.id, tenantId, organizationId }
    if (input.customerEntityId !== undefined) body.customerEntityId = input.customerEntityId
    if (input.paymentNo !== undefined) body.paymentNo = input.paymentNo
    if (input.status !== undefined) body.status = input.status
    if (input.amount !== undefined) body.amount = input.amount
    if (input.currencyCode !== undefined) body.currencyCode = input.currencyCode
    if (input.paidOn !== undefined) body.paidOn = input.paidOn
    if (input.isActive !== undefined) body.isActive = input.isActive
    const response = await runner.run({ method: 'PUT', path: '/commercial/payments', body })
    if (!response.success) throw new Error(response.error ?? `Failed to update payment "${existing.id}"`)
    const after = await loadPaymentForScope(em, ctx as CommercialToolContext, tenantId, existing.id)
    return { paymentId: existing.id, commandName: 'commercial.payments.update', before: paymentSnapshot(existing), after: after ? paymentSnapshot(after) : null }
  },
}) as CommercialAiToolDefinition

const manageAllocationTool = defineAiTool({
  name: 'commercial.manage_allocation',
  displayName: 'Manage payment allocation',
  description: 'Create or update a payment allocation with confirm-required approval and allocation guards.',
  inputSchema: manageAllocationInput,
  requiredFeatures: ['commercial.manage'],
  isMutation: true,
  loadBeforeRecord: loadAllocationPreview,
  async handler(rawInput: ManageAllocationInput, ctx: CommercialToolContext) {
    const { tenantId, organizationId } = assertTenantScope(ctx)
    const input = manageAllocationInput.parse(rawInput)
    const em = resolveEm(ctx)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)

    if (input.operation === 'create') {
      if (!organizationId) throw new Error('[internal] Organization scope is required to create an allocation.')
      await assertAllocationWithinLimits({
        em,
        tenantId,
        organizationId,
        invoiceId: input.invoiceId!,
        paymentId: input.paymentId!,
        allocatedAmount: input.allocatedAmount!,
      })
      const response = await runner.run<{ id?: string }>({
        method: 'POST',
        path: '/commercial/allocations',
        body: {
          tenantId,
          organizationId,
          invoiceId: input.invoiceId,
          paymentId: input.paymentId,
          allocatedAmount: input.allocatedAmount,
          allocatedOn: input.allocatedOn ?? null,
          isActive: input.isActive,
        },
      })
      if (!response.success) throw new Error(response.error ?? 'Failed to create allocation')
      const allocationId = typeof response.data?.id === 'string' ? response.data.id : null
      if (!allocationId) throw new Error('Allocation create succeeded without an id.')
      const after = await loadAllocationForScope(em, ctx as CommercialToolContext, tenantId, allocationId)
      return {
        allocationId,
        commandName: 'commercial.allocations.create',
        before: null,
        after: after ? allocationSnapshot(after) : null,
      }
    }

    const existing = await loadAllocationForScope(em, ctx as CommercialToolContext, tenantId, input.allocationId!)
    if (!existing) throw new Error(`Allocation "${input.allocationId}" is not accessible to the caller.`)
    if (!organizationId) throw new Error('[internal] Organization scope is required to update an allocation.')
    const nextInvoiceId = input.invoiceId ?? existing.invoiceId
    const nextPaymentId = input.paymentId ?? existing.paymentId
    const nextAllocatedAmount = input.allocatedAmount ?? existing.allocatedAmount
    await assertAllocationWithinLimits({
      em,
      tenantId,
      organizationId,
      invoiceId: nextInvoiceId,
      paymentId: nextPaymentId,
      allocatedAmount: nextAllocatedAmount,
      excludeAllocationId: existing.id,
    })
    const body: Record<string, unknown> = { id: existing.id, tenantId, organizationId }
    if (input.invoiceId !== undefined) body.invoiceId = input.invoiceId
    if (input.paymentId !== undefined) body.paymentId = input.paymentId
    if (input.allocatedAmount !== undefined) body.allocatedAmount = input.allocatedAmount
    if (input.allocatedOn !== undefined) body.allocatedOn = input.allocatedOn
    if (input.isActive !== undefined) body.isActive = input.isActive
    const response = await runner.run({ method: 'PUT', path: '/commercial/allocations', body })
    if (!response.success) throw new Error(response.error ?? `Failed to update allocation "${existing.id}"`)
    const after = await loadAllocationForScope(em, ctx as CommercialToolContext, tenantId, existing.id)
    return {
      allocationId: existing.id,
      commandName: 'commercial.allocations.update',
      before: allocationSnapshot(existing),
      after: after ? allocationSnapshot(after) : null,
    }
  },
}) as CommercialAiToolDefinition

export const aiTools: CommercialAiToolDefinition[] = [
  manageContractTool,
  manageInvoiceTool,
  managePaymentTool,
  manageAllocationTool,
]

export default aiTools
