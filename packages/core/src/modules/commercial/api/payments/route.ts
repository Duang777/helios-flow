import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@helios/shared/lib/crud/factory'
import { CommercialPayment } from '../../data/entities'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@helios/shared/lib/auth/server'
import { createRequestContainer } from '@helios/shared/lib/di/container'
import { escapeLikePattern } from '@helios/shared/lib/db/escapeLikePattern'
import { paymentCreateSchema, paymentUpdateSchema } from '../../data/validators'
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
    entity: CommercialPayment,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'commercial',
    entity: 'payment',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'commercial.payments.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.paymentId) }),
      status: 201,
    },
    update: {
      commandId: 'commercial.payments.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'commercial.payments.delete',
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
    sortField: z.enum(['paidOn', 'amount', 'status', 'createdAt', 'updatedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    status: z.string().optional(),
    customerEntityId: z.uuid().optional(),
    isActive: z.enum(['true', 'false']).optional(),
  })
  .loose()

type PaymentRow = {
  id: string
  customerEntityId: string | null
  paymentNo: string | null
  status: string
  amount: string
  currencyCode: string
  paidOn: string
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (row: CommercialPayment): PaymentRow => ({
  id: String(row.id),
  customerEntityId: row.customerEntityId ?? null,
  paymentNo: row.paymentNo ?? null,
  status: String(row.status),
  amount: String(row.amount),
  currencyCode: String(row.currencyCode),
  paidOn: row.paidOn,
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
    customerEntityId: url.searchParams.get('customerEntityId') ?? undefined,
    isActive: url.searchParams.get('isActive') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const { id, page, pageSize, search, sortField, sortDir, status, customerEntityId, isActive } = parsed.data

  const filter: FilterQuery<CommercialPayment> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) filter.organizationId = auth.orgId
  if (id) filter.id = id
  if (status) filter.status = status
  if (customerEntityId) filter.customerEntityId = customerEntityId
  if (isActive === 'true') filter.isActive = true
  if (isActive === 'false') filter.isActive = false
  if (search) {
    filter.paymentNo = { $ilike: `%${escapeLikePattern(search)}%` }
  }

  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    orderBy[sortField] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.paidOn = 'DESC'
  }

  const offset = (page - 1) * pageSize
  const [rows, total] = await em.findAndCount(CommercialPayment, filter, { orderBy, limit: pageSize, offset })
  const items = rows.map(toRow)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return NextResponse.json({ items, total, page, pageSize, totalPages })
}

export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const paymentItemSchema = z.object({
  id: z.string(),
  customerEntityId: z.string().nullable(),
  paymentNo: z.string().nullable(),
  status: z.string(),
  amount: z.string(),
  currencyCode: z.string(),
  paidOn: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.string(),
  tenantId: z.string(),
})

export const openApi = createCommercialCrudOpenApi({
  resourceName: 'CommercialPayment',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(paymentItemSchema),
  create: { schema: paymentCreateSchema, description: 'Create a commercial payment' },
  update: {
    schema: paymentUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Update a commercial payment',
  },
  del: {
    schema: z.object({ id: z.uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-delete a commercial payment',
  },
})
