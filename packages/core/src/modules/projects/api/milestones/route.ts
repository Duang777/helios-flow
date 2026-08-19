import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@helios/shared/lib/crud/factory'
import { ProjectMilestone } from '../../data/entities'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@helios/shared/lib/auth/server'
import { createRequestContainer } from '@helios/shared/lib/di/container'
import { escapeLikePattern } from '@helios/shared/lib/db/escapeLikePattern'
import { milestoneCreateSchema, milestoneUpdateSchema } from '../../data/validators'
import { isMilestoneDelayed } from '../../lib/milestoneDelay'
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
    entity: ProjectMilestone,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'projects',
    entity: 'project_milestone',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'projects.milestones.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.milestoneId) }),
      status: 201,
    },
    update: {
      commandId: 'projects.milestones.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'projects.milestones.delete',
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
    sortField: z.enum(['name', 'plannedDate', 'sortOrder', 'createdAt', 'updatedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    projectId: z.uuid().optional(),
    status: z.string().optional(),
    delayedOnly: z.enum(['true', 'false']).optional(),
  })
  .loose()

type MilestoneRow = {
  id: string
  projectId: string
  name: string
  status: string
  plannedDate: string | null
  actualDate: string | null
  sortOrder: number
  isDelayed: boolean
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (row: ProjectMilestone): MilestoneRow => ({
  id: String(row.id),
  projectId: String(row.projectId),
  name: String(row.name),
  status: String(row.status),
  plannedDate: row.plannedDate ?? null,
  actualDate: row.actualDate ?? null,
  sortOrder: row.sortOrder,
  isDelayed: isMilestoneDelayed({
    plannedDate: row.plannedDate,
    actualDate: row.actualDate,
    status: row.status,
  }),
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
    delayedOnly: url.searchParams.get('delayedOnly') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const { id, page, pageSize, search, sortField, sortDir, projectId, status, delayedOnly } = parsed.data

  const filter: FilterQuery<ProjectMilestone> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) filter.organizationId = auth.orgId
  if (id) filter.id = id
  if (projectId) filter.projectId = projectId
  if (status) filter.status = status
  if (search) {
    filter.name = { $ilike: `%${escapeLikePattern(search)}%` }
  }

  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    orderBy[sortField] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.sortOrder = 'ASC'
  }

  const offset = (page - 1) * pageSize
  let [rows, total] = await em.findAndCount(ProjectMilestone, filter, { orderBy, limit: pageSize, offset })
  let items = rows.map(toRow)
  if (delayedOnly === 'true') {
    items = items.filter((item) => item.isDelayed)
    total = items.length
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return NextResponse.json({ items, total, page, pageSize, totalPages })
}

export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const milestoneItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  status: z.string(),
  plannedDate: z.string().nullable(),
  actualDate: z.string().nullable(),
  sortOrder: z.number(),
  isDelayed: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.string(),
  tenantId: z.string(),
})

export const openApi = createProjectsCrudOpenApi({
  resourceName: 'ProjectMilestone',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(milestoneItemSchema),
  create: { schema: milestoneCreateSchema, description: 'Create a project milestone' },
  update: {
    schema: milestoneUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Update a project milestone',
  },
  del: {
    schema: z.object({ id: z.uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-delete a project milestone',
  },
})
