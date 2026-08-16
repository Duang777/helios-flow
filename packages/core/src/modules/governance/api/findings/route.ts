import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@helios/shared/lib/crud/factory'
import { GovernanceFinding } from '../../data/entities'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@helios/shared/lib/auth/server'
import { createRequestContainer } from '@helios/shared/lib/di/container'
import { escapeLikePattern } from '@helios/shared/lib/db/escapeLikePattern'
import { findingCreateSchema, findingUpdateSchema } from '../../data/validators'
import {
  createGovernanceCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['governance.view'] },
  POST: { requireAuth: true, requireFeatures: ['governance.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['governance.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['governance.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).loose()
type CrudInput = Record<string, unknown>

const crud = makeCrudRoute<CrudInput, CrudInput, Record<string, unknown>>({
  metadata: routeMetadata,
  orm: {
    entity: GovernanceFinding,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'governance',
    entity: 'finding',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'governance.findings.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.findingId) }),
      status: 201,
    },
    update: {
      commandId: 'governance.findings.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'governance.findings.delete',
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
      .enum(['ruleId', 'severity', 'status', 'detectedAt', 'asOf', 'createdAt', 'updatedAt'])
      .optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    ruleId: z.string().optional(),
    severity: z.string().optional(),
    status: z.string().optional(),
    subjectType: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
  })
  .loose()

type FindingRow = {
  id: string
  ruleId: string
  severity: string
  status: string
  title: string
  reason: string
  evidenceIds: Array<{ type: string; id: string; module: string }>
  subjectType: string
  subjectId: string
  impactSummary: string | null
  ownerRole: string | null
  suggestedDueOn: string | null
  payload: Record<string, unknown> | null
  detectedAt: string | null
  asOf: string
  isSimulation: boolean
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (row: GovernanceFinding): FindingRow => ({
  id: String(row.id),
  ruleId: String(row.ruleId),
  severity: String(row.severity),
  status: String(row.status),
  title: String(row.title),
  reason: String(row.reason),
  evidenceIds: Array.isArray(row.evidenceIds) ? row.evidenceIds : [],
  subjectType: String(row.subjectType),
  subjectId: String(row.subjectId),
  impactSummary: row.impactSummary ?? null,
  ownerRole: row.ownerRole ?? null,
  suggestedDueOn: row.suggestedDueOn ?? null,
  payload: row.payload ?? null,
  detectedAt: row.detectedAt ? row.detectedAt.toISOString() : null,
  asOf: String(row.asOf),
  isSimulation: !!row.isSimulation,
  isActive: !!row.isActive,
  createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  organizationId: String(row.organizationId),
  tenantId: String(row.tenantId),
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
    ruleId: url.searchParams.get('ruleId') ?? undefined,
    severity: url.searchParams.get('severity') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    subjectType: url.searchParams.get('subjectType') ?? undefined,
    isActive: url.searchParams.get('isActive') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const {
    id,
    page,
    pageSize,
    search,
    sortField,
    sortDir,
    ruleId,
    severity,
    status,
    subjectType,
    isActive,
  } = parsed.data

  const filter: FilterQuery<GovernanceFinding> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) filter.organizationId = auth.orgId
  if (id) filter.id = id
  if (ruleId) filter.ruleId = ruleId
  if (severity) filter.severity = severity
  if (status) filter.status = status
  if (subjectType) filter.subjectType = subjectType
  if (isActive === 'true') filter.isActive = true
  if (isActive === 'false') filter.isActive = false
  if (search) {
    filter.$or = [
      { title: { $ilike: `%${escapeLikePattern(search)}%` } },
      { reason: { $ilike: `%${escapeLikePattern(search)}%` } },
      { ruleId: { $ilike: `%${escapeLikePattern(search)}%` } },
    ]
  }

  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    orderBy[sortField] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.detectedAt = 'DESC'
  }

  const offset = (page - 1) * pageSize
  const [rows, total] = await em.findAndCount(GovernanceFinding, filter, {
    orderBy,
    limit: pageSize,
    offset,
  })
  const items = rows.map(toRow)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return NextResponse.json({ items, total, page, pageSize, totalPages })
}

export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const findingItemSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  severity: z.string(),
  status: z.string(),
  title: z.string(),
  reason: z.string(),
  evidenceIds: z.array(
    z.object({
      type: z.string(),
      id: z.string(),
      module: z.string(),
    }),
  ),
  subjectType: z.string(),
  subjectId: z.string(),
  impactSummary: z.string().nullable(),
  ownerRole: z.string().nullable(),
  suggestedDueOn: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  detectedAt: z.string().nullable(),
  asOf: z.string(),
  isSimulation: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.string(),
  tenantId: z.string(),
})

export const openApi = createGovernanceCrudOpenApi({
  resourceName: 'GovernanceFinding',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(findingItemSchema),
  create: { schema: findingCreateSchema, description: 'Create a governance finding' },
  update: {
    schema: findingUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Update finding status or disposition fields',
  },
  del: {
    schema: z.object({ id: z.uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-delete a finding',
  },
})
