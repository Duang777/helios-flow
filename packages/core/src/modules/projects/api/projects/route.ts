import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@helios/shared/lib/crud/factory'
import { Project } from '../../data/entities'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@helios/shared/lib/auth/server'
import { createRequestContainer } from '@helios/shared/lib/di/container'
import { escapeLikePattern } from '@helios/shared/lib/db/escapeLikePattern'
import { projectCreateSchema, projectUpdateSchema } from '../../data/validators'
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
    entity: Project,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'projects',
    entity: 'project',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'projects.projects.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.projectId) }),
      status: 201,
    },
    update: {
      commandId: 'projects.projects.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'projects.projects.delete',
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
    sortField: z.enum(['name', 'status', 'createdAt', 'updatedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    status: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
    customerEntityId: z.uuid().optional(),
    dealId: z.uuid().optional(),
  })
  .loose()

type ProjectRow = {
  id: string
  name: string
  code: string | null
  status: string
  customerEntityId: string | null
  dealId: string | null
  projectManagerId: string | null
  productLineCode: string | null
  bizCategory: string | null
  budgetRevenue: string | null
  budgetCost: string | null
  forecastRevenue: string | null
  forecastCost: string | null
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (project: Project): ProjectRow => ({
  id: String(project.id),
  name: String(project.name),
  code: project.code ?? null,
  status: String(project.status),
  customerEntityId: project.customerEntityId ?? null,
  dealId: project.dealId ?? null,
  projectManagerId: project.projectManagerId ?? null,
  productLineCode: project.productLineCode ?? null,
  bizCategory: project.bizCategory ?? null,
  budgetRevenue: project.budgetRevenue ?? null,
  budgetCost: project.budgetCost ?? null,
  forecastRevenue: project.forecastRevenue ?? null,
  forecastCost: project.forecastCost ?? null,
  isActive: !!project.isActive,
  createdAt: project.createdAt ? project.createdAt.toISOString() : null,
  updatedAt: project.updatedAt ? project.updatedAt.toISOString() : null,
  organizationId: String(project.organizationId),
  tenantId: String(project.tenantId),
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
    status: url.searchParams.get('status') ?? undefined,
    isActive: url.searchParams.get('isActive') ?? undefined,
    customerEntityId: url.searchParams.get('customerEntityId') ?? undefined,
    dealId: url.searchParams.get('dealId') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const { id, page, pageSize, search, sortField, sortDir, status, isActive, customerEntityId, dealId } =
    parsed.data

  const filter: FilterQuery<Project> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) filter.organizationId = auth.orgId
  if (id) filter.id = id
  if (status) filter.status = status
  if (customerEntityId) filter.customerEntityId = customerEntityId
  if (dealId) filter.dealId = dealId
  if (isActive === 'true') filter.isActive = true
  if (isActive === 'false') filter.isActive = false
  if (search) {
    filter.$or = [
      { name: { $ilike: `%${escapeLikePattern(search)}%` } },
      { code: { $ilike: `%${escapeLikePattern(search)}%` } },
    ]
  }

  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    orderBy[sortField] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.updatedAt = 'DESC'
  }

  const offset = (page - 1) * pageSize
  const [rows, total] = await em.findAndCount(Project, filter, { orderBy, limit: pageSize, offset })
  const items = rows.map(toRow)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return NextResponse.json({ items, total, page, pageSize, totalPages })
}

export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const projectItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  status: z.string(),
  customerEntityId: z.string().nullable(),
  dealId: z.string().nullable(),
  projectManagerId: z.string().nullable(),
  productLineCode: z.string().nullable(),
  bizCategory: z.string().nullable(),
  budgetRevenue: z.string().nullable(),
  budgetCost: z.string().nullable(),
  forecastRevenue: z.string().nullable(),
  forecastCost: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.string(),
  tenantId: z.string(),
})

export const openApi = createProjectsCrudOpenApi({
  resourceName: 'Project',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(projectItemSchema),
  create: { schema: projectCreateSchema, description: 'Create a delivery project' },
  update: { schema: projectUpdateSchema, responseSchema: defaultOkResponseSchema, description: 'Update a project' },
  del: {
    schema: z.object({ id: z.uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-delete a project',
  },
})
