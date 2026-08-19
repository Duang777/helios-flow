import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@helios/shared/lib/crud/factory'
import { KpiTarget } from '../../data/entities'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@helios/shared/lib/auth/server'
import { createRequestContainer } from '@helios/shared/lib/di/container'
import { escapeLikePattern } from '@helios/shared/lib/db/escapeLikePattern'
import { kpiTargetCreateSchema, kpiTargetUpdateSchema } from '../../data/validators'
import {
  createInsightsCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['insights.view'] },
  POST: { requireAuth: true, requireFeatures: ['insights.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['insights.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['insights.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).loose()
type CrudInput = Record<string, unknown>

const crud = makeCrudRoute<CrudInput, CrudInput, Record<string, unknown>>({
  metadata: routeMetadata,
  orm: {
    entity: KpiTarget,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'insights',
    entity: 'kpi_target',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'insights.kpi_targets.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.kpiTargetId) }),
      status: 201,
    },
    update: {
      commandId: 'insights.kpi_targets.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'insights.kpi_targets.delete',
      schema: rawBodySchema,
      mapInput: ({ raw, ctx }) => ({
        id: ((raw as Record<string, unknown>).query as Record<string, unknown> | undefined)?.id as
          | string
          | undefined,
        organizationId: ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? undefined,
        tenantId: ctx.auth?.tenantId ?? undefined,
      }),
      response: () => ({ ok: true }),
    },
  },
})

const listQuerySchema = z
  .object({
    id: z.uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    sortField: z
      .enum(['metricKey', 'periodKey', 'targetValue', 'createdAt', 'updatedAt'])
      .optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    metricKey: z.string().optional(),
    periodType: z.string().optional(),
    periodKey: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
  })
  .loose()

type KpiTargetRow = {
  id: string
  metricKey: string
  unit: string
  periodType: string
  periodKey: string
  targetValue: string
  currencyCode: string | null
  note: string | null
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (target: KpiTarget): KpiTargetRow => ({
  id: String(target.id),
  metricKey: String(target.metricKey),
  unit: String(target.unit),
  periodType: String(target.periodType),
  periodKey: String(target.periodKey),
  targetValue: String(target.targetValue),
  currencyCode: target.currencyCode ?? null,
  note: target.note ?? null,
  isActive: !!target.isActive,
  createdAt: target.createdAt ? target.createdAt.toISOString() : null,
  updatedAt: target.updatedAt ? target.updatedAt.toISOString() : null,
  organizationId: String(target.organizationId),
  tenantId: String(target.tenantId),
})

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth || !auth.tenantId || (!auth.orgId && !auth.isSuperAdmin)) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 401 })
  }

  const url = new URL(req.url)
  const parsed = listQuerySchema.safeParse({
    id: url.searchParams.get('id') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
    sortField: url.searchParams.get('sortField') ?? undefined,
    sortDir: url.searchParams.get('sortDir') ?? undefined,
    metricKey: url.searchParams.get('metricKey') ?? undefined,
    periodType: url.searchParams.get('periodType') ?? undefined,
    periodKey: url.searchParams.get('periodKey') ?? undefined,
    isActive: url.searchParams.get('isActive') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const { id, page, pageSize, search, sortField, sortDir, metricKey, periodType, periodKey, isActive } =
    parsed.data

  const filter: FilterQuery<KpiTarget> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) filter.organizationId = auth.orgId
  if (id) filter.id = id
  if (metricKey) filter.metricKey = metricKey
  if (periodType) filter.periodType = periodType
  if (periodKey) filter.periodKey = periodKey
  if (isActive === 'true') filter.isActive = true
  if (isActive === 'false') filter.isActive = false
  if (search) {
    filter.$or = [
      { metricKey: { $ilike: `%${escapeLikePattern(search)}%` } },
      { periodKey: { $ilike: `%${escapeLikePattern(search)}%` } },
      { note: { $ilike: `%${escapeLikePattern(search)}%` } },
    ]
  }

  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    orderBy[sortField] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.updatedAt = 'DESC'
  }

  const offset = (page - 1) * pageSize
  const [rows, total] = await em.findAndCount(KpiTarget, filter, { orderBy, limit: pageSize, offset })
  const items = rows.map(toRow)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return NextResponse.json({ items, total, page, pageSize, totalPages })
}

export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const kpiTargetItemSchema = z.object({
  id: z.string(),
  metricKey: z.string(),
  unit: z.string(),
  periodType: z.string(),
  periodKey: z.string(),
  targetValue: z.string(),
  currencyCode: z.string().nullable(),
  note: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.string(),
  tenantId: z.string(),
})

export const openApi = createInsightsCrudOpenApi({
  resourceName: 'KpiTarget',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(kpiTargetItemSchema),
  create: { schema: kpiTargetCreateSchema, description: 'Create a KPI target' },
  update: {
    schema: kpiTargetUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Update a KPI target',
  },
  del: {
    schema: z.object({ id: z.uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-delete a KPI target',
  },
})
