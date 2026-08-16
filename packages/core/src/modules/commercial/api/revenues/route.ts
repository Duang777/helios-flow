import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@helios/shared/lib/crud/factory'
import { ProjectRevenue } from '../../data/entities'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@helios/shared/lib/auth/server'
import { createRequestContainer } from '@helios/shared/lib/di/container'
import { revenueCreateSchema, revenueUpdateSchema } from '../../data/validators'
import {
  createCommercialCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['commercial.view'] },
  POST: { requireAuth: true, requireFeatures: ['commercial.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['commercial.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['commercial.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).loose()
type CrudInput = Record<string, unknown>

const crud = makeCrudRoute<CrudInput, CrudInput, Record<string, unknown>>({
  metadata: routeMetadata,
  orm: {
    entity: ProjectRevenue,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'commercial',
    entity: 'project_revenue',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'commercial.revenues.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.revenueId) }),
      status: 201,
    },
    update: {
      commandId: 'commercial.revenues.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'commercial.revenues.delete',
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
    sortField: z.enum(['recognizedOn', 'amount', 'createdAt', 'updatedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    projectId: z.uuid().optional(),
    contractId: z.uuid().optional(),
    isActive: z.enum(['true', 'false']).optional(),
  })
  .loose()

type RevenueRow = {
  id: string
  projectId: string
  contractId: string | null
  dataVersion: string
  amount: string
  currencyCode: string
  recognizedOn: string
  note: string | null
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (row: ProjectRevenue): RevenueRow => ({
  id: String(row.id),
  projectId: String(row.projectId),
  contractId: row.contractId ?? null,
  dataVersion: String(row.dataVersion),
  amount: String(row.amount),
  currencyCode: String(row.currencyCode),
  recognizedOn: row.recognizedOn,
  note: row.note ?? null,
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
    sortField: url.searchParams.get('sortField') ?? undefined,
    sortDir: url.searchParams.get('sortDir') ?? undefined,
    projectId: url.searchParams.get('projectId') ?? undefined,
    contractId: url.searchParams.get('contractId') ?? undefined,
    isActive: url.searchParams.get('isActive') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const { id, page, pageSize, sortField, sortDir, projectId, contractId, isActive } = parsed.data

  const filter: FilterQuery<ProjectRevenue> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) filter.organizationId = auth.orgId
  if (id) filter.id = id
  if (projectId) filter.projectId = projectId
  if (contractId) filter.contractId = contractId
  if (isActive === 'true') filter.isActive = true
  if (isActive === 'false') filter.isActive = false

  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    orderBy[sortField] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.recognizedOn = 'DESC'
  }

  const offset = (page - 1) * pageSize
  const [rows, total] = await em.findAndCount(ProjectRevenue, filter, { orderBy, limit: pageSize, offset })
  const items = rows.map(toRow)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return NextResponse.json({ items, total, page, pageSize, totalPages })
}

export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const revenueItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  contractId: z.string().nullable(),
  dataVersion: z.string(),
  amount: z.string(),
  currencyCode: z.string(),
  recognizedOn: z.string(),
  note: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.string(),
  tenantId: z.string(),
})

export const openApi = createCommercialCrudOpenApi({
  resourceName: 'ProjectRevenue',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(revenueItemSchema),
  create: { schema: revenueCreateSchema, description: 'Create a project revenue line' },
  update: {
    schema: revenueUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Update a project revenue line',
  },
  del: {
    schema: z.object({ id: z.uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-delete a project revenue line',
  },
})
