import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import type { OpenApiRouteDoc } from '@helios/shared/lib/openapi'
import { getAuthFromRequest } from '@helios/shared/lib/auth/server'
import { createRequestContainer } from '@helios/shared/lib/di/container'
import { isCrudHttpError } from '@helios/shared/lib/crud/errors'
import {
  CommercialContract,
  CommercialInvoice,
  PaymentAllocation,
  ProjectCost,
  ProjectRevenue,
} from '../../data/entities'
import { computeCommercialMetrics } from '../../lib/metrics'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['commercial.view'] },
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

const metricsQuerySchema = z.object({
  organizationId: z.uuid(),
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  projectId: z.uuid().optional(),
  contractId: z.uuid().optional(),
})

const metricDefinitionSchema = z.object({
  formula: z.string(),
  sources: z.array(z.string()),
})

const metricsResponseSchema = z.object({
  actualRevenue: z.string(),
  actualCost: z.string(),
  projectGrossProfit: z.string(),
  projectGrossMargin: z.string().nullable(),
  invoiceRate: z.string().nullable(),
  allocatedPayment: z.string(),
  collectionRate: z.string().nullable(),
  arOutstanding: z.string(),
  overdueOutstanding: z.string(),
  asOf: z.string(),
  currencyCode: z.string(),
  filters: z.record(z.string(), z.string().optional()),
  definitions: z.record(z.string(), metricDefinitionSchema),
})

const errorSchema = z.object({ error: z.string() })

function buildScopedFilter(
  tenantId: string,
  organizationId: string,
  projectId?: string,
  contractId?: string,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    tenantId,
    organizationId,
    deletedAt: null,
  }
  if (projectId) filter.projectId = projectId
  if (contractId) filter.contractId = contractId
  return filter
}

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth || !auth.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const parsed = metricsQuerySchema.safeParse({
    organizationId: url.searchParams.get('organizationId') ?? undefined,
    asOf: url.searchParams.get('asOf') ?? undefined,
    projectId: url.searchParams.get('projectId') ?? undefined,
    contractId: url.searchParams.get('contractId') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
  }

  const { organizationId, projectId, contractId } = parsed.data
  const asOf = parsed.data.asOf ?? todayUtcDate()

  if (!auth.isSuperAdmin && auth.orgId && auth.orgId !== organizationId) {
    return NextResponse.json({ error: 'Organization scope mismatch' }, { status: 403 })
  }

  try {
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const tenantId = auth.tenantId

    const revenueFilter = buildScopedFilter(tenantId, organizationId, projectId, contractId) as FilterQuery<ProjectRevenue>
    const costFilter = buildScopedFilter(tenantId, organizationId, projectId, contractId) as FilterQuery<ProjectCost>

    const contractFilter: FilterQuery<CommercialContract> = {
      tenantId,
      organizationId,
      deletedAt: null,
    }
    if (projectId) contractFilter.projectId = projectId
    if (contractId) contractFilter.id = contractId

    const invoiceFilter = buildScopedFilter(tenantId, organizationId, projectId, contractId) as FilterQuery<CommercialInvoice>

    const [revenues, costs, contracts, invoices] = await Promise.all([
      em.find(ProjectRevenue, revenueFilter),
      em.find(ProjectCost, costFilter),
      em.find(CommercialContract, contractFilter),
      em.find(CommercialInvoice, invoiceFilter),
    ])

    const invoiceIds = new Set(invoices.map((row) => row.id))
    const allocationFilter: FilterQuery<PaymentAllocation> = {
      tenantId,
      organizationId,
      deletedAt: null,
    }
    if (projectId || contractId) {
      allocationFilter.invoiceId = { $in: Array.from(invoiceIds) }
    }

    const allocations = await em.find(PaymentAllocation, allocationFilter)
    const scopedAllocations =
      projectId || contractId ? allocations.filter((row) => invoiceIds.has(row.invoiceId)) : allocations

    const filters: Record<string, string | undefined> = {
      organizationId,
      asOf,
      projectId,
      contractId,
    }

    const metrics = computeCommercialMetrics({
      revenues: revenues.map((row) => ({ amount: row.amount, dataVersion: row.dataVersion })),
      costs: costs.map((row) => ({ amount: row.amount, dataVersion: row.dataVersion })),
      contracts: contracts.map((row) => ({ amount: row.amount, status: row.status })),
      invoices: invoices.map((row) => ({
        id: row.id,
        amount: row.amount,
        dueDate: row.dueDate ?? null,
        status: row.status,
      })),
      allocations: scopedAllocations.map((row) => ({
        invoiceId: row.invoiceId,
        allocatedAmount: row.allocatedAmount,
      })),
      asOf,
      filters,
    })

    return NextResponse.json(metrics)
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    return NextResponse.json({ error: 'Failed to compute commercial metrics' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Commercial',
  summary: 'Commercial metrics',
  methods: {
    GET: {
      summary: 'Compute commercial settlement metrics',
      description:
        'Returns PRD §7.9 operating metrics (revenue, cost, invoice/collection rates, AR outstanding) scoped to tenant and organization.',
      query: metricsQuerySchema,
      responses: [{ status: 200, description: 'Metrics payload', schema: metricsResponseSchema }],
      errors: [
        { status: 400, description: 'Invalid query parameters', schema: errorSchema },
        { status: 401, description: 'Unauthorized', schema: errorSchema },
        { status: 403, description: 'Organization scope mismatch', schema: errorSchema },
        { status: 500, description: 'Metrics computation failed', schema: errorSchema },
      ],
    },
  },
}
