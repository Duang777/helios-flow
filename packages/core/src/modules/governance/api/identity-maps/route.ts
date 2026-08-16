import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@helios/shared/lib/crud/factory'
import { CustomerIdentityMap } from '../../data/entities'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@helios/shared/lib/auth/server'
import { createRequestContainer } from '@helios/shared/lib/di/container'
import { escapeLikePattern } from '@helios/shared/lib/db/escapeLikePattern'
import { identityMapCreateSchema, identityMapUpdateSchema } from '../../data/validators'
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
    entity: CustomerIdentityMap,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'governance',
    entity: 'identity_map',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'governance.identity_maps.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.identityMapId) }),
      status: 201,
    },
    update: {
      commandId: 'governance.identity_maps.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'governance.identity_maps.delete',
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
      .enum(['status', 'sourceEntityId', 'canonicalEntityId', 'createdAt', 'updatedAt'])
      .optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    status: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
  })
  .loose()

type IdentityMapRow = {
  id: string
  sourceEntityId: string
  sourceCustomerCode: string | null
  canonicalEntityId: string
  canonicalCustomerCode: string | null
  rationale: string
  status: string
  isSimulation: boolean
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (row: CustomerIdentityMap): IdentityMapRow => ({
  id: String(row.id),
  sourceEntityId: String(row.sourceEntityId),
  sourceCustomerCode: row.sourceCustomerCode ?? null,
  canonicalEntityId: String(row.canonicalEntityId),
  canonicalCustomerCode: row.canonicalCustomerCode ?? null,
  rationale: String(row.rationale),
  status: String(row.status),
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
    status: url.searchParams.get('status') ?? undefined,
    isActive: url.searchParams.get('isActive') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const { id, page, pageSize, search, sortField, sortDir, status, isActive } = parsed.data

  const filter: FilterQuery<CustomerIdentityMap> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) filter.organizationId = auth.orgId
  if (id) filter.id = id
  if (status) filter.status = status
  if (isActive === 'true') filter.isActive = true
  if (isActive === 'false') filter.isActive = false
  if (search) {
    filter.$or = [
      { rationale: { $ilike: `%${escapeLikePattern(search)}%` } },
      { sourceCustomerCode: { $ilike: `%${escapeLikePattern(search)}%` } },
      { canonicalCustomerCode: { $ilike: `%${escapeLikePattern(search)}%` } },
    ]
  }

  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    orderBy[sortField] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.updatedAt = 'DESC'
  }

  const offset = (page - 1) * pageSize
  const [rows, total] = await em.findAndCount(CustomerIdentityMap, filter, {
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

const identityMapItemSchema = z.object({
  id: z.string(),
  sourceEntityId: z.string(),
  sourceCustomerCode: z.string().nullable(),
  canonicalEntityId: z.string(),
  canonicalCustomerCode: z.string().nullable(),
  rationale: z.string(),
  status: z.string(),
  isSimulation: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.string(),
  tenantId: z.string(),
})

export const openApi = createGovernanceCrudOpenApi({
  resourceName: 'CustomerIdentityMap',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(identityMapItemSchema),
  create: { schema: identityMapCreateSchema, description: 'Create a customer identity map (source row kept)' },
  update: {
    schema: identityMapUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Update a customer identity map',
  },
  del: {
    schema: z.object({ id: z.uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-delete an identity map',
  },
})
