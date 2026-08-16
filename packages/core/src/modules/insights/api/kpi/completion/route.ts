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
} from '../../../../commercial/data/entities'
import { Organization } from '../../../../directory/data/entities'
import { KpiTarget } from '../../../data/entities'
import { completionQuerySchema, validatePeriodKey } from '../../../data/validators'
import {
  buildCompletionItem,
  computeMetricActuals,
  extractMetricComponents,
  type DatedCommercialFacts,
  type MetricKey,
} from '../../../lib/completion'
import { resolveChildOrganizationIds, rollupChildren, type RollupChildAmounts } from '../../../lib/rollup'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['insights.view'] },
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

const completionItemSchema = z.object({
  organizationId: z.string(),
  metricKey: z.string(),
  targetValue: z.string().nullable(),
  actualValue: z.string().nullable(),
  completionRate: z.string().nullable(),
  unit: z.enum(['amount', 'ratio']),
  currencyCode: z.string().nullable(),
  actualSource: z.enum(['commercial.metrics', 'projects']),
  isRollup: z.boolean().optional(),
})

const completionResponseSchema = z.object({
  items: z.array(completionItemSchema),
  rollup: z.array(completionItemSchema),
  asOf: z.string(),
  periodType: z.string(),
  periodKey: z.string(),
})

const errorSchema = z.object({ error: z.string() })

async function loadFactsByOrganization(
  em: EntityManager,
  tenantId: string,
  organizationIds: string[],
): Promise<Map<string, DatedCommercialFacts>> {
  const scopeFilter = {
    tenantId,
    organizationId: { $in: organizationIds },
    deletedAt: null,
  }

  const [revenues, costs, contracts, invoices, allocations] = await Promise.all([
    em.find(ProjectRevenue, scopeFilter as FilterQuery<ProjectRevenue>),
    em.find(ProjectCost, scopeFilter as FilterQuery<ProjectCost>),
    em.find(CommercialContract, scopeFilter as FilterQuery<CommercialContract>),
    em.find(CommercialInvoice, scopeFilter as FilterQuery<CommercialInvoice>),
    em.find(PaymentAllocation, scopeFilter as FilterQuery<PaymentAllocation>),
  ])

  const map = new Map<string, DatedCommercialFacts>()
  for (const orgId of organizationIds) {
    map.set(orgId, {
      revenues: [],
      costs: [],
      contracts: [],
      invoices: [],
      allocations: [],
    })
  }

  for (const row of revenues) {
    const bucket = map.get(row.organizationId)
    if (bucket) {
      bucket.revenues.push({
        amount: row.amount,
        dataVersion: row.dataVersion,
        recognizedOn: row.recognizedOn,
      })
    }
  }
  for (const row of costs) {
    const bucket = map.get(row.organizationId)
    if (bucket) {
      bucket.costs.push({
        amount: row.amount,
        dataVersion: row.dataVersion,
        incurredOn: row.incurredOn,
      })
    }
  }
  for (const row of contracts) {
    const bucket = map.get(row.organizationId)
    if (bucket) {
      bucket.contracts.push({
        amount: row.amount,
        status: row.status,
        startDate: row.startDate ?? null,
      })
    }
  }
  for (const row of invoices) {
    const bucket = map.get(row.organizationId)
    if (bucket) {
      bucket.invoices.push({
        id: row.id,
        amount: row.amount,
        dueDate: row.dueDate ?? null,
        status: row.status,
        issuedOn: row.issuedOn,
      })
    }
  }
  for (const row of allocations) {
    const bucket = map.get(row.organizationId)
    if (bucket) {
      bucket.allocations.push({
        invoiceId: row.invoiceId,
        allocatedAmount: row.allocatedAmount,
        allocatedOn: row.allocatedOn ?? null,
      })
    }
  }

  return map
}

async function buildItemsForOrganization(input: {
  em: EntityManager
  tenantId: string
  organizationId: string
  periodType: z.infer<typeof completionQuerySchema>['periodType']
  periodKey: string
  asOf: string
  targets: KpiTarget[]
  factsByOrg: Map<string, DatedCommercialFacts>
}): Promise<z.infer<typeof completionItemSchema>[]> {
  const orgFacts = input.factsByOrg.get(input.organizationId) ?? {
    revenues: [],
    costs: [],
    contracts: [],
    invoices: [],
    allocations: [],
  }
  const items: z.infer<typeof completionItemSchema>[] = []
  const metricKeys: MetricKey[] = ['revenue', 'gross_profit', 'gross_margin', 'collection']

  for (const metricKey of metricKeys) {
    const target = input.targets.find(
      (row) =>
        row.organizationId === input.organizationId &&
        row.metricKey === metricKey &&
        row.periodType === input.periodType &&
        row.periodKey === input.periodKey &&
        row.isActive &&
        !row.deletedAt,
    )
    const actuals = computeMetricActuals(orgFacts, input.periodType, input.periodKey, metricKey, input.asOf)
    items.push(
      buildCompletionItem({
        organizationId: input.organizationId,
        metricKey,
        targetValue: target?.targetValue ?? null,
        actualValue: actuals.actualValue,
        unit: actuals.unit,
        currencyCode: target?.currencyCode ?? (actuals.unit === 'amount' ? 'CNY' : null),
        actualSource: actuals.actualSource,
      }),
    )
  }

  return items
}

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth || !auth.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const parsed = completionQuerySchema.safeParse({
    organizationId: url.searchParams.get('organizationId') ?? undefined,
    periodType: url.searchParams.get('periodType') ?? undefined,
    periodKey: url.searchParams.get('periodKey') ?? undefined,
    asOf: url.searchParams.get('asOf') ?? undefined,
    includeDescendants: url.searchParams.get('includeDescendants') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
  }

  const { organizationId, periodType, periodKey } = parsed.data
  if (!validatePeriodKey(periodType, periodKey)) {
    return NextResponse.json({ error: 'periodKey does not match periodType' }, { status: 400 })
  }

  const asOf = parsed.data.asOf ?? todayUtcDate()
  const includeDescendants = parsed.data.includeDescendants === 'true'

  if (!auth.isSuperAdmin && auth.orgId && auth.orgId !== organizationId) {
    return NextResponse.json({ error: 'Organization scope mismatch' }, { status: 403 })
  }

  try {
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const tenantId = auth.tenantId

    const org = await em.findOne(Organization, {
      id: organizationId,
      deletedAt: null,
    })
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const childOrgIds = resolveChildOrganizationIds(
      organizationId,
      Array.isArray(org.childIds) ? org.childIds.map(String) : [],
      Array.isArray(org.descendantIds) ? org.descendantIds.map(String) : [],
    )

    const orgIdsForQuery = includeDescendants
      ? [organizationId, ...childOrgIds]
      : [organizationId]

    const targets = await em.find(KpiTarget, {
      tenantId,
      organizationId: { $in: orgIdsForQuery },
      periodType,
      periodKey,
      deletedAt: null,
      isActive: true,
    } as FilterQuery<KpiTarget>)

    const factsByOrg = await loadFactsByOrganization(em, tenantId, orgIdsForQuery)

    const items: z.infer<typeof completionItemSchema>[] = []

    if (includeDescendants && childOrgIds.length > 0) {
      for (const childOrgId of childOrgIds) {
        const childItems = await buildItemsForOrganization({
          em,
          tenantId,
          organizationId: childOrgId,
          periodType,
          periodKey,
          asOf,
          targets,
          factsByOrg,
        })
        items.push(...childItems)
      }
    } else {
      const orgItems = await buildItemsForOrganization({
        em,
        tenantId,
        organizationId,
        periodType,
        periodKey,
        asOf,
        targets,
        factsByOrg,
      })
      items.push(...orgItems)
    }

    const rollup: z.infer<typeof completionItemSchema>[] = []
    if (includeDescendants && childOrgIds.length > 0) {
      const metricKeys: MetricKey[] = ['revenue', 'gross_profit', 'gross_margin', 'collection']
      for (const metricKey of metricKeys) {
        const childRows: RollupChildAmounts[] = childOrgIds.map((childOrgId) => {
          const orgFacts = factsByOrg.get(childOrgId)!
          const target = targets.find(
            (row) => row.organizationId === childOrgId && row.metricKey === metricKey,
          )
          const actuals = computeMetricActuals(orgFacts, periodType, periodKey, metricKey, asOf)
          const components = extractMetricComponents(orgFacts, periodType, periodKey, asOf)
          return {
            organizationId: childOrgId,
            metricKey,
            targetValue: target?.targetValue ?? null,
            actualValue: actuals.actualValue,
            unit: actuals.unit,
            currencyCode: target?.currencyCode ?? null,
            revenueActual: components.revenue,
            grossProfitActual: components.grossProfit,
            collectionAllocated: components.collectionNumerator,
            collectionInvoiced: components.collectionDenominator,
          }
        })
        const rolled = rollupChildren(
          organizationId,
          metricKey,
          childRows,
          childRows.find((row) => row.currencyCode)?.currencyCode ?? 'CNY',
        )
        rollup.push({
          ...rolled,
          actualSource: 'commercial.metrics',
          isRollup: true,
        })
      }
    }

    return NextResponse.json({
      items,
      rollup,
      asOf,
      periodType,
      periodKey,
    })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    return NextResponse.json({ error: 'Failed to compute KPI completion' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Insights',
  summary: 'KPI completion',
  methods: {
    GET: {
      summary: 'Compute KPI target completion rates',
      description:
        'Joins KPI targets with commercial operating metrics. When includeDescendants=true, returns child org rows plus derived rollup (margin = Σ profit / Σ revenue).',
      query: completionQuerySchema,
      responses: [{ status: 200, description: 'Completion payload', schema: completionResponseSchema }],
      errors: [
        { status: 400, description: 'Invalid query parameters', schema: errorSchema },
        { status: 401, description: 'Unauthorized', schema: errorSchema },
        { status: 403, description: 'Organization scope mismatch', schema: errorSchema },
        { status: 404, description: 'Organization not found', schema: errorSchema },
        { status: 500, description: 'Completion computation failed', schema: errorSchema },
      ],
    },
  },
}
