import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@helios/shared/lib/openapi'
import { getAuthFromRequest } from '@helios/shared/lib/auth/server'
import { createRequestContainer } from '@helios/shared/lib/di/container'
import { isCrudHttpError } from '@helios/shared/lib/crud/errors'
import { collectOperatingLoopTodayDigest } from '../../../lib/operatingLoopToday'

export const metadata = {
  GET: {
    requireAuth: true,
    requireFeatures: ['projects.view', 'commercial.view', 'insights.view', 'governance.view'],
  },
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

const todayDigestQuerySchema = z.object({
  organizationId: z.uuid(),
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

const sourceStatusSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
})

const digestDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  severity: z.enum(['critical', 'warning', 'info']),
  entityType: z.enum([
    'governance.finding',
    'commercial.invoice',
    'projects.project',
    'insights.kpi_target',
  ]),
  recordId: z.string(),
  organizationId: z.string(),
  href: z.string(),
  formulaSource: z.string(),
  amount: z.string().nullable(),
  currencyCode: z.string().nullable(),
  evidenceIds: z.array(
    z.object({
      type: z.string(),
      id: z.string(),
      module: z.string(),
    }),
  ),
  scopedIds: z.record(z.string(), z.string().optional()),
  facts: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
})

const digestResponseSchema = z.object({
  asOf: z.string(),
  periodType: z.string(),
  periodKey: z.string(),
  formulaSources: z.string(),
  metrics: z.object({
    criticalFindingCount: z.number(),
    delayedProjectCount: z.number(),
    overdueInvoiceCount: z.number(),
    overdueOutstanding: z.string(),
    kpiGapCount: z.number(),
    periodType: z.string(),
    periodKey: z.string(),
  }),
  groups: z.object({
    criticalFindings: z.array(digestDetailSchema),
    overdueInvoices: z.array(digestDetailSchema),
    delayedProjects: z.array(digestDetailSchema),
    kpiGaps: z.array(digestDetailSchema),
  }),
  sourceStatus: z.object({
    criticalFindings: sourceStatusSchema,
    overdueInvoices: sourceStatusSchema,
    delayedProjects: sourceStatusSchema,
    kpiGaps: sourceStatusSchema,
  }),
})

const errorSchema = z.object({ error: z.string() })

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth || !auth.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const parsed = todayDigestQuerySchema.safeParse({
    organizationId: url.searchParams.get('organizationId') ?? undefined,
    asOf: url.searchParams.get('asOf') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
  }

  const { organizationId } = parsed.data
  const asOf = parsed.data.asOf ?? todayUtcDate()
  if (!auth.isSuperAdmin && auth.orgId && auth.orgId !== organizationId) {
    return NextResponse.json({ error: 'Organization scope mismatch' }, { status: 403 })
  }

  try {
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const digest = await collectOperatingLoopTodayDigest(em, {
      tenantId: auth.tenantId,
      organizationId,
      asOf,
    })
    return NextResponse.json(digest)
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    return NextResponse.json({ error: 'Failed to load operating loop digest' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Insights',
  summary: 'Today operating loop digest',
  methods: {
    GET: {
      summary: 'Return grouped operating-loop signals for today',
      description:
        'Returns critical governance findings, overdue invoices, delayed projects, and KPI gaps using the same source formulas as the Operating Loop Assistant.',
      query: todayDigestQuerySchema,
      responses: [{ status: 200, description: 'Operating digest payload', schema: digestResponseSchema }],
      errors: [
        { status: 400, description: 'Invalid query parameters', schema: errorSchema },
        { status: 401, description: 'Unauthorized', schema: errorSchema },
        { status: 403, description: 'Organization scope mismatch', schema: errorSchema },
        { status: 500, description: 'Operating digest load failed', schema: errorSchema },
      ],
    },
  },
}
