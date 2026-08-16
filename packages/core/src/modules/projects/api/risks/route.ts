import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@helios/shared/lib/crud/factory'
import { ProjectRisk } from '../../data/entities'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@helios/shared/lib/auth/server'
import { createRequestContainer } from '@helios/shared/lib/di/container'
import { escapeLikePattern } from '@helios/shared/lib/db/escapeLikePattern'
import { riskCreateSchema, riskUpdateSchema } from '../../data/validators'
import {
  createProjectsCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['projects.view'] },
  POST: { requireAuth: true, requireFeatures: ['projects.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['projects.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['projects.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).loose()
type CrudInput = Record<string, unknown>

const crud = makeCrudRoute<CrudInput, CrudInput, Record<string, unknown>>({
  metadata: routeMetadata,
  orm: {
    entity: ProjectRisk,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'projects',
    entity: 'project_risk',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'projects.risks.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.riskId) }),
      status: 201,
    },
    update: {
      commandId: 'projects.risks.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'projects.risks.delete',
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
    sortField: z.enum(['title', 'riskType', 'status', 'createdAt', 'updatedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    projectId: z.uuid().optional(),
    status: z.string().optional(),
    riskType: z.string().optional(),
  })
  .loose()

type RiskRow = {
  id: string
  projectId: string
  title: string
  description: string | null
  riskType: string
  status: string
  ownerEmployeeId: string | null
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (row: ProjectRisk): RiskRow => ({
  id: String(row.id),
  projectId: String(row.projectId),
  title: String(row.title),
  description: row.description ?? null,
  riskType: String(row.riskType),
  status: String(row.status),
  ownerEmployeeId: row.ownerEmployeeId ?? null,
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
    projectId: url.searchParams.get('projectId') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    riskType: url.searchParams.get('riskType') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const { id, page, pageSize, search, sortField, sortDir, projectId, status, riskType } = parsed.data

  const filter: FilterQuery<ProjectRisk> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) filter.organizationId = auth.orgId
  if (id) filter.id = id
  if (projectId) filter.projectId = projectId
  if (status) filter.status = status
  if (riskType) filter.riskType = riskType
  if (search) {
    filter.$or = [
      { title: { $ilike: `%${escapeLikePattern(search)}%` } },
      { description: { $ilike: `%${escapeLikePattern(search)}%` } },
    ]
  }

  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    orderBy[sortField] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.updatedAt = 'DESC'
  }

  const offset = (page - 1) * pageSize
  const [rows, total] = await em.findAndCount(ProjectRisk, filter, { orderBy, limit: pageSize, offset })
  const items = rows.map(toRow)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return NextResponse.json({ items, total, page, pageSize, totalPages })
}

export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const riskItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  riskType: z.string(),
  status: z.string(),
  ownerEmployeeId: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.string(),
  tenantId: z.string(),
})

export const openApi = createProjectsCrudOpenApi({
  resourceName: 'ProjectRisk',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(riskItemSchema),
  create: { schema: riskCreateSchema, description: 'Create a project risk' },
  update: { schema: riskUpdateSchema, responseSchema: defaultOkResponseSchema, description: 'Update a project risk' },
  del: {
    schema: z.object({ id: z.uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-delete a project risk',
  },
})
