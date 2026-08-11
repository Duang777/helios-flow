import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { defineApiBackedAiTool } from '@helios/ai-assistant/modules/ai_assistant/lib/api-backed-tool'
import { defineAiTool } from '@helios/ai-assistant'
import type { AiApiOperationRequest } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import { CommercialInvoice, PaymentAllocation } from '../data/entities'
import { fromMoneyCents, isOperatingInvoiceStatus, METRIC_DEFINITIONS, toMoneyCents } from '../lib/metrics'
import {
  createAiApiOperationRunner,
  type AiToolExecutionContext,
} from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolDefinition, McpToolContext } from '@helios/ai-assistant/modules/ai_assistant/lib/types'
import {
  assertTenantScope,
  type CommercialAiToolDefinition,
  type CommercialToolContext,
} from './types'

const listContractsInput = z
  .object({
    q: z.string().trim().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
    projectId: z.string().uuid().optional(),
    customerEntityId: z.string().uuid().optional(),
    status: z.string().optional(),
  })
  .passthrough()

type ListContractsInput = z.infer<typeof listContractsInput>

type ListApiResponse = {
  items?: Array<Record<string, unknown>>
  total?: number
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function requireOrganizationScope(ctx: CommercialToolContext): string {
  const scope = assertTenantScope(ctx)
  if (!scope.organizationId) {
    throw new Error('[internal] Organization context is required for commercial.* operating-loop tools')
  }
  return scope.organizationId
}

function dateToUtcMs(date: string): number | null {
  const parts = date.split('-').map((part) => Number.parseInt(part, 10))
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null
  const [year, month, day] = parts
  return Date.UTC(year, month - 1, day)
}

function overdueDays(dueDate: string | null, asOf: string): number | null {
  if (!dueDate) return null
  const dueMs = dateToUtcMs(dueDate)
  const asOfMs = dateToUtcMs(asOf)
  if (dueMs === null || asOfMs === null || dueMs >= asOfMs) return 0
  return Math.floor((asOfMs - dueMs) / 86_400_000)
}

const listContractsTool = defineApiBackedAiTool<
  ListContractsInput,
  ListApiResponse,
  { items: Array<Record<string, unknown>>; total: number; limit: number; offset: number }
>({
  name: 'commercial.list_contracts',
  displayName: 'List contracts',
  description: 'List commercial contracts for the caller tenant + organization.',
  inputSchema: listContractsInput,
  requiredFeatures: ['commercial.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as CommercialToolContext)
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const page = Math.floor(offset / limit) + 1
    const query: Record<string, string | number | boolean | null | undefined> = {
      page,
      pageSize: limit,
    }
    if (input.q?.trim()) query.search = input.q.trim()
    if (input.projectId) query.projectId = input.projectId
    if (input.customerEntityId) query.customerEntityId = input.customerEntityId
    if (input.status) query.status = input.status
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/commercial/contracts',
      query,
    }
    return operation
  },
  mapResponse: (response, input) => {
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const data = (response.data ?? {}) as ListApiResponse
    const rawItems = Array.isArray(data.items) ? data.items : []
    return {
      items: rawItems.map((row) => ({
        id: row.id,
        name: row.name ?? null,
        code: row.code ?? null,
        status: row.status ?? null,
        amount: row.amount ?? null,
        projectId: row.projectId ?? row.project_id ?? null,
        customerEntityId: row.customerEntityId ?? row.customer_entity_id ?? null,
        href: typeof row.id === 'string' ? `/backend/commercial/contracts/${row.id}` : null,
      })),
      total: typeof data.total === 'number' ? data.total : 0,
      limit,
      offset,
    }
  },
}) as unknown as CommercialAiToolDefinition

const getContractInput = z.object({
  contractId: z.string().uuid(),
})

type GetContractInput = z.infer<typeof getContractInput>

const getContractTool = defineApiBackedAiTool<GetContractInput, ListApiResponse, Record<string, unknown> | null>({
  name: 'commercial.get_contract',
  displayName: 'Get contract',
  description: 'Fetch one commercial contract by id.',
  inputSchema: getContractInput,
  requiredFeatures: ['commercial.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as CommercialToolContext)
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/commercial/contracts',
      query: { id: input.contractId, page: 1, pageSize: 1 },
    }
    return operation
  },
  mapResponse: (response) => {
    const data = (response.data ?? {}) as ListApiResponse
    const row = Array.isArray(data.items) ? data.items[0] : null
    if (!row || typeof row.id !== 'string') return null
    return {
      id: row.id,
      name: row.name ?? null,
      status: row.status ?? null,
      amount: row.amount ?? null,
      projectId: row.projectId ?? row.project_id ?? null,
      href: `/backend/commercial/contracts/${row.id}`,
    }
  },
}) as unknown as CommercialAiToolDefinition

const getMetricsInput = z
  .object({
    asOf: z.string().optional().describe('Metrics cutoff date YYYY-MM-DD'),
    projectId: z.string().uuid().optional(),
    contractId: z.string().uuid().optional(),
  })
  .passthrough()

type GetMetricsInput = z.infer<typeof getMetricsInput>

const getMetricsTool = defineApiBackedAiTool<GetMetricsInput, Record<string, unknown>, Record<string, unknown>>({
  name: 'commercial.get_metrics',
  displayName: 'Get commercial metrics',
  description:
    'Returns PRD §7.9 operating metrics (invoice rate, collection rate, AR, overdue) with formula definitions.',
  inputSchema: getMetricsInput,
  requiredFeatures: ['commercial.view'],
  toOperation: (input, ctx) => {
    const scope = assertTenantScope(ctx as unknown as CommercialToolContext)
    const query: Record<string, string | undefined> = {}
    if (scope.organizationId) query.organizationId = scope.organizationId
    if (input.asOf) query.asOf = input.asOf
    if (input.projectId) query.projectId = input.projectId
    if (input.contractId) query.contractId = input.contractId
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/commercial/metrics',
      query,
    }
    return operation
  },
  mapResponse: (response) => (response.data ?? {}) as Record<string, unknown>,
}) as unknown as CommercialAiToolDefinition

const getProjectSettlementSummaryInput = z
  .object({
    projectId: z.string().uuid(),
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .passthrough()

type GetProjectSettlementSummaryInput = z.infer<typeof getProjectSettlementSummaryInput>

const getProjectSettlementSummaryTool = defineApiBackedAiTool<
  GetProjectSettlementSummaryInput,
  Record<string, unknown>,
  Record<string, unknown>
>({
  name: 'commercial.get_project_settlement_summary',
  displayName: 'Get project settlement summary',
  description:
    'Return commercial metrics scoped to one project, with formula definitions and deep links for operating-loop answers.',
  inputSchema: getProjectSettlementSummaryInput,
  requiredFeatures: ['commercial.view'],
  toOperation: (input, ctx) => {
    const organizationId = requireOrganizationScope(ctx as unknown as CommercialToolContext)
    const query: Record<string, string> = {
      organizationId,
      projectId: input.projectId,
    }
    if (input.asOf) query.asOf = input.asOf
    return {
      method: 'GET',
      path: '/commercial/metrics',
      query,
    }
  },
  mapResponse: (response, input) => ({
    projectId: input.projectId,
    metrics: response.data ?? {},
    hrefs: {
      project: `/backend/projects/${input.projectId}`,
      commercial: '/backend/commercial',
    },
    formulaSource:
      'commercial.metrics definitions. Collection rate uses Σ allocated_amount ÷ Σ issued invoice_amount; overdue outstanding uses issued invoice remainder where due_date < asOf.',
  }),
}) as unknown as CommercialAiToolDefinition

const listInvoicesInput = z
  .object({
    q: z.string().trim().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
    contractId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    status: z.string().optional(),
  })
  .passthrough()

type ListInvoicesInput = z.infer<typeof listInvoicesInput>

const listInvoicesTool = defineApiBackedAiTool<
  ListInvoicesInput,
  ListApiResponse,
  { items: Array<Record<string, unknown>>; total: number; limit: number; offset: number }
>({
  name: 'commercial.list_invoices',
  displayName: 'List invoices',
  description: 'List commercial invoices for the caller tenant + organization.',
  inputSchema: listInvoicesInput,
  requiredFeatures: ['commercial.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as CommercialToolContext)
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const page = Math.floor(offset / limit) + 1
    const query: Record<string, string | number | boolean | null | undefined> = {
      page,
      pageSize: limit,
    }
    if (input.q?.trim()) query.search = input.q.trim()
    if (input.contractId) query.contractId = input.contractId
    if (input.projectId) query.projectId = input.projectId
    if (input.status) query.status = input.status
    return {
      method: 'GET',
      path: '/commercial/invoices',
      query,
    }
  },
  mapResponse: (response, input) => {
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const data = (response.data ?? {}) as ListApiResponse
    const rawItems = Array.isArray(data.items) ? data.items : []
    return {
      items: rawItems.map((row) => ({
        id: row.id,
        invoiceNo: row.invoiceNo ?? row.invoice_no ?? null,
        status: row.status ?? null,
        amount: row.amount ?? null,
        dueDate: row.dueDate ?? row.due_date ?? null,
        contractId: row.contractId ?? row.contract_id ?? null,
        href: typeof row.id === 'string' ? `/backend/commercial/invoices/${row.id}` : null,
      })),
      total: typeof data.total === 'number' ? data.total : 0,
      limit,
      offset,
    }
  },
}) as unknown as CommercialAiToolDefinition

const listOverdueInvoicesInput = z
  .object({
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    projectId: z.string().uuid().optional(),
    contractId: z.string().uuid().optional(),
    customerEntityId: z.string().uuid().optional(),
  })
  .passthrough()

type ListOverdueInvoicesInput = z.infer<typeof listOverdueInvoicesInput>

const listOverdueInvoicesTool = defineAiTool({
  name: 'commercial.list_overdue_invoices',
  displayName: 'List overdue invoices',
  description:
    'List issued invoices with overdue outstanding balances. Computes invoice remainder from payment_allocations and returns formula source plus deep links.',
  inputSchema: listOverdueInvoicesInput,
  requiredFeatures: ['commercial.view'],
  async handler(input: ListOverdueInvoicesInput, ctx: CommercialToolContext) {
    const tenantScope = assertTenantScope(ctx)
    const organizationId = requireOrganizationScope(ctx)
    const em = ctx.container.resolve('em') as EntityManager
    const asOf = input.asOf ?? todayUtcDate()
    const limit = input.limit ?? 50
    const filter: FilterQuery<CommercialInvoice> = {
      tenantId: tenantScope.tenantId,
      organizationId,
      deletedAt: null,
      status: 'issued',
      dueDate: { $lt: asOf },
    }
    if (input.projectId) filter.projectId = input.projectId
    if (input.contractId) filter.contractId = input.contractId
    if (input.customerEntityId) filter.customerEntityId = input.customerEntityId

    const invoices = await em.find(CommercialInvoice, filter, {
      orderBy: { dueDate: 'ASC' },
      limit: 100,
    })
    const invoiceIds = invoices.map((invoice) => invoice.id)
    const allocations =
      invoiceIds.length > 0
        ? await em.find(PaymentAllocation, {
            tenantId: tenantScope.tenantId,
            organizationId,
            deletedAt: null,
            invoiceId: { $in: invoiceIds },
          } as FilterQuery<PaymentAllocation>)
        : []

    const allocatedByInvoice = new Map<string, bigint>()
    for (const allocation of allocations) {
      const previous = allocatedByInvoice.get(allocation.invoiceId) ?? 0n
      allocatedByInvoice.set(allocation.invoiceId, previous + toMoneyCents(allocation.allocatedAmount))
    }

    const items = invoices
      .filter((invoice) => isOperatingInvoiceStatus(invoice.status))
      .map((invoice) => {
        const allocatedCents = allocatedByInvoice.get(invoice.id) ?? 0n
        const outstandingCents = toMoneyCents(invoice.amount) - allocatedCents
        return {
          id: invoice.id,
          invoiceNo: invoice.invoiceNo ?? null,
          projectId: invoice.projectId ?? null,
          contractId: invoice.contractId ?? null,
          customerEntityId: invoice.customerEntityId ?? null,
          amount: invoice.amount,
          allocatedAmount: fromMoneyCents(allocatedCents),
          outstandingAmount: fromMoneyCents(outstandingCents > 0n ? outstandingCents : 0n),
          currencyCode: invoice.currencyCode,
          dueDate: invoice.dueDate ?? null,
          overdueDays: overdueDays(invoice.dueDate ?? null, asOf),
          href: `/backend/commercial/invoices/${invoice.id}`,
        }
      })
      .filter((invoice) => toMoneyCents(invoice.outstandingAmount) > 0n)
      .slice(0, limit)

    return {
      items,
      total: items.length,
      asOf,
      formulaSource:
        'overdueOutstanding = Σ (issued invoice_amount - allocated_amount) where due_date < asOf and remainder > 0. Sources: commercial_invoices, payment_allocations.',
      href: '/backend/commercial/invoices',
    }
  },
}) as unknown as CommercialAiToolDefinition

const listPaymentsInput = z
  .object({
    q: z.string().trim().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
    status: z.string().optional(),
  })
  .passthrough()

type ListPaymentsInput = z.infer<typeof listPaymentsInput>

const listPaymentsTool = defineApiBackedAiTool<
  ListPaymentsInput,
  ListApiResponse,
  { items: Array<Record<string, unknown>>; total: number; limit: number; offset: number }
>({
  name: 'commercial.list_payments',
  displayName: 'List payments',
  description: 'List commercial payments for the caller tenant + organization.',
  inputSchema: listPaymentsInput,
  requiredFeatures: ['commercial.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as CommercialToolContext)
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const page = Math.floor(offset / limit) + 1
    const query: Record<string, string | number | boolean | null | undefined> = {
      page,
      pageSize: limit,
    }
    if (input.q?.trim()) query.search = input.q.trim()
    if (input.status) query.status = input.status
    return {
      method: 'GET',
      path: '/commercial/payments',
      query,
    }
  },
  mapResponse: (response, input) => {
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const data = (response.data ?? {}) as ListApiResponse
    const rawItems = Array.isArray(data.items) ? data.items : []
    return {
      items: rawItems.map((row) => ({
        id: row.id,
        status: row.status ?? null,
        amount: row.amount ?? null,
        paidOn: row.paidOn ?? row.paid_on ?? null,
        href: typeof row.id === 'string' ? `/backend/commercial/payments/${row.id}` : null,
      })),
      total: typeof data.total === 'number' ? data.total : 0,
      limit,
      offset,
    }
  },
}) as unknown as CommercialAiToolDefinition

const listPaymentAllocationsInput = z
  .object({
    invoiceId: z.string().uuid().optional(),
    paymentId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .passthrough()

type ListPaymentAllocationsInput = z.infer<typeof listPaymentAllocationsInput>

const listPaymentAllocationsTool = defineApiBackedAiTool<
  ListPaymentAllocationsInput,
  ListApiResponse,
  { items: Array<Record<string, unknown>>; total: number; limit: number; offset: number }
>({
  name: 'commercial.list_payment_allocations',
  displayName: 'List payment allocations',
  description:
    'List invoice-payment allocation details for reconciliation explanations. Use this for 核销明细.',
  inputSchema: listPaymentAllocationsInput,
  requiredFeatures: ['commercial.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as CommercialToolContext)
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const page = Math.floor(offset / limit) + 1
    const query: Record<string, string | number> = { page, pageSize: limit }
    if (input.invoiceId) query.invoiceId = input.invoiceId
    if (input.paymentId) query.paymentId = input.paymentId
    return {
      method: 'GET',
      path: '/commercial/allocations',
      query,
    }
  },
  mapResponse: (response, input) => {
    const limit = input.limit ?? 50
    const offset = input.offset ?? 0
    const data = (response.data ?? {}) as ListApiResponse
    const rawItems = Array.isArray(data.items) ? data.items : []
    return {
      items: rawItems.map((row) => ({
        id: row.id,
        invoiceId: row.invoiceId ?? row.invoice_id ?? null,
        paymentId: row.paymentId ?? row.payment_id ?? null,
        allocatedAmount: row.allocatedAmount ?? row.allocated_amount ?? null,
        allocatedOn: row.allocatedOn ?? row.allocated_on ?? null,
        href: typeof row.id === 'string' ? `/backend/commercial/allocations/${row.id}` : null,
      })),
      total: typeof data.total === 'number' ? data.total : 0,
      limit,
      offset,
      formulaSource:
        'Allocations are the only payment numerator for collection rate: Σ allocated_amount ÷ Σ issued invoice_amount.',
    }
  },
}) as unknown as CommercialAiToolDefinition

const METRIC_KEY_LIST = Object.keys(METRIC_DEFINITIONS) as [string, ...string[]]

const explainMetricInput = z
  .object({
    metricKey: z
      .enum(METRIC_KEY_LIST)
      .optional()
      .describe(
        'Commercial metric key (e.g. collectionRate, arOutstanding). Omit to list all metric definitions.',
      ),
  })
  .passthrough()

type ExplainMetricInput = z.infer<typeof explainMetricInput>

const explainMetricTool = defineAiTool({
  name: 'commercial.explain_metric',
  displayName: 'Explain commercial metric',
  description:
    'Explain how a commercial operating metric (collection rate, AR, gross profit, etc.) is calculated ' +
    'and which source tables feed it. Use this to cite the formula source in settlement answers without pulling live numbers.',
  inputSchema: explainMetricInput,
  requiredFeatures: ['commercial.view'],
  tags: ['read', 'explain', 'operating-loop', 'commercial'],
  isMutation: false,
  async handler(rawInput: unknown, ctx: McpToolContext) {
    assertTenantScope(ctx as unknown as CommercialToolContext)
    const input = explainMetricInput.parse(rawInput)
    if (input.metricKey) {
      const definition = METRIC_DEFINITIONS[input.metricKey]
      if (!definition) {
        return { found: false, metricKey: input.metricKey }
      }
      return {
        found: true,
        metricKey: input.metricKey,
        formula: definition.formula,
        sources: definition.sources,
        href: '/backend/commercial/contracts',
      }
    }
    return {
      found: true,
      metrics: METRIC_KEY_LIST.map((key) => ({
        metricKey: key,
        formula: METRIC_DEFINITIONS[key].formula,
        sources: METRIC_DEFINITIONS[key].sources,
      })),
    }
  },
}) as unknown as CommercialAiToolDefinition

const suggestCollectionActionsInput = z
  .object({
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Evaluation date (YYYY-MM-DD). Defaults to today.'),
    limit: z.number().int().min(1).max(100).optional().describe('Maximum invoices to evaluate (default 50).'),
  })
  .passthrough()

type SuggestCollectionActionsInput = z.infer<typeof suggestCollectionActionsInput>

const collectionActionSuggestion = z.object({
  invoiceId: z.string().describe('Invoice the action applies to.'),
  action: z.enum(['send_reminder', 'escalate', 'schedule_call', 'write_off_review']).describe('Recommended collection action.'),
  priority: z.enum(['high', 'medium', 'low']).describe('Action priority.'),
  ownerRole: z.string().describe('Recommended owner role for the action.'),
})

const SUGGEST_COLLECTION_ACTIONS_SCHEMA = 'CommercialCollectionActionSuggestion'

const suggestCollectionActionsTool = defineAiTool({
  name: 'commercial.suggest_collection_actions',
  displayName: 'Suggest collection actions',
  description:
    'Build structured collection-action suggestions for overdue issued invoices. Read-only — the tool returns ' +
    'a proposal (initially empty) plus a `linkedMutations` array describing the commercial write tools that ' +
    'can persist each suggestion (e.g. `commercial.manage_payment`, `commercial.manage_allocation`, ' +
    '`commercial.manage_invoice`). After this tool returns, ALWAYS follow up by calling one of those linked ' +
    'write tools with the corresponding `argsTemplate` substituted from each proposal item. The mutation ' +
    'itself is gated by `ai_assistant.actions.manage`, so chain through the standard pending-actions confirm.',
  inputSchema: suggestCollectionActionsInput,
  requiredFeatures: ['commercial.view'],
  tags: ['read', 'suggest', 'operating-loop', 'commercial'],
  isMutation: false,
  async handler(rawInput: unknown, ctx: McpToolContext) {
    const input = suggestCollectionActionsInput.parse(rawInput)
    const scope = assertTenantScope(ctx as unknown as CommercialToolContext)
    const organizationId = requireOrganizationScope(ctx as unknown as CommercialToolContext)
    const asOf = input.asOf ?? todayUtcDate()
    const toolCtx: AiToolExecutionContext = { ...ctx, tool: suggestCollectionActionsTool as unknown as AiToolDefinition }
    const runner = createAiApiOperationRunner(toolCtx)
    const response = await runner.run({
      method: 'GET',
      path: '/commercial/invoices',
      query: { organizationId, status: 'issued', page: 1, pageSize: input.limit ?? 50 },
    })
    if (!response.success) {
      throw new Error(response.error ?? 'Failed to load invoices for collection suggestions.')
    }
    const data = (response.data ?? {}) as { items?: Array<Record<string, unknown>> }
    const items = Array.isArray(data.items) ? data.items : []
    const overdueInvoices = items
      .map((row) => {
        const dueDate = (row.dueDate ?? row.due_date ?? null) as string | null
        const days = overdueDays(dueDate, asOf) ?? 0
        return {
          invoiceId: row.id,
          invoiceNo: (row.invoiceNo ?? row.invoice_no ?? null) as string | null,
          dueDate,
          overdueDays: days,
          amount: (row.amount ?? row.outstandingAmount ?? null) as string | null,
          href: typeof row.id === 'string' ? `/backend/commercial/invoices/${row.id}` : null,
        }
      })
      .filter((invoice) => invoice.overdueDays > 0)
      .sort((left, right) => right.overdueDays - left.overdueDays)
    return {
      found: true,
      organizationId: scope.organizationId,
      asOf,
      overdueInvoiceCount: overdueInvoices.length,
      context: { overdueInvoices },
      proposal: { actions: [] as Array<z.infer<typeof collectionActionSuggestion>> },
      // `linkedMutations` closes the two-stage loop: after the agent fills
      // `proposal.actions[]` with `{invoiceId, action, priority, ownerRole}`,
      // it can pick a write tool below and copy `argsTemplate` with
      // placeholder substitution. Under `confirm-required`, those calls
      // produce an AiPendingAction and route through the confirm gate.
      linkedMutations: [
        {
          toolName: 'commercial.manage_payment',
          purpose:
            'Record a payment that closes / offsets the overdue invoice; pairs with `manage_allocation` to attach it.',
          argsTemplate: {
            operation: 'create',
            customerEntityId: null,
            paymentNo: '${action}-${invoiceNo ?? invoiceId}',
            status: 'posted',
            amount: '${amount}',
            currencyCode: 'USD',
            paidOn: '${asOf}',
          },
        },
        {
          toolName: 'commercial.manage_allocation',
          purpose:
            'Pair the recorded payment with the overdue invoice (must satisfy allocation within-limits guard).',
          argsTemplate: {
            operation: 'create',
            invoiceId: '${invoiceId}',
            paymentId: '${paymentId}',
            allocatedAmount: '${amount}',
            allocatedOn: '${asOf}',
          },
        },
        {
          toolName: 'commercial.manage_invoice',
          purpose:
            'Void the invoice when the recommended action is write_off_review (status changes to "void").',
          argsTemplate: {
            operation: 'update',
            invoiceId: '${invoiceId}',
            status: 'void',
          },
        },
      ],
      outputSchemaDescriptor: {
        schemaName: SUGGEST_COLLECTION_ACTIONS_SCHEMA,
        jsonSchema: z.toJSONSchema(collectionActionSuggestion) as Record<string, unknown>,
      },
      href: '/backend/commercial/invoices',
    }
  },
}) as unknown as CommercialAiToolDefinition

const commercialAiTools: CommercialAiToolDefinition[] = [
  listContractsTool,
  getContractTool,
  listInvoicesTool,
  listOverdueInvoicesTool,
  listPaymentsTool,
  listPaymentAllocationsTool,
  getMetricsTool,
  getProjectSettlementSummaryTool,
  explainMetricTool,
  suggestCollectionActionsTool,
]

export default commercialAiTools
