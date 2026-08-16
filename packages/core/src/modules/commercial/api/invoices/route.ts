import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@helios/shared/lib/crud/factory'
import { CommercialInvoice } from '../../data/entities'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@helios/shared/lib/auth/server'
import { createRequestContainer } from '@helios/shared/lib/di/container'
import { escapeLikePattern } from '@helios/shared/lib/db/escapeLikePattern'
import { invoiceCreateSchema, invoiceUpdateSchema } from '../../data/validators'
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
    entity: CommercialInvoice,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'commercial',
    entity: 'invoice',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'commercial.invoices.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.invoiceId) }),
      status: 201,
    },
    update: {
      commandId: 'commercial.invoices.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'commercial.invoices.delete',
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
    sortField: z.enum(['issuedOn', 'amount', 'status', 'createdAt', 'updatedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    status: z.string().optional(),
    projectId: z.uuid().optional(),
    contractId: z.uuid().optional(),
    customerEntityId: z.uuid().optional(),
    isActive: z.enum(['true', 'false']).optional(),
  })
  .loose()

type InvoiceRow = {
  id: string
  contractId: string | null
  projectId: string | null
  customerEntityId: string | null
  invoiceNo: string | null
  status: string
  amount: string
  currencyCode: string
  issuedOn: string
  dueDate: string | null
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (row: CommercialInvoice): InvoiceRow => ({
  id: String(row.id),
  contractId: row.contractId ?? null,
  projectId: row.projectId ?? null,
  customerEntityId: row.customerEntityId ?? null,
  invoiceNo: row.invoiceNo ?? null,
  status: String(row.status),
  amount: String(row.amount),
  currencyCode: String(row.currencyCode),
  issuedOn: row.issuedOn,
  dueDate: row.dueDate ?? null,
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
    projectId: url.searchParams.get('projectId') ?? undefined,
    contractId: url.searchParams.get('contractId') ?? undefined,
    customerEntityId: url.searchParams.get('customerEntityId') ?? undefined,
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
    status,
    projectId,
    contractId,
    customerEntityId,
    isActive,
  } = parsed.data

  const filter: FilterQuery<CommercialInvoice> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) filter.organizationId = auth.orgId
  if (id) filter.id = id
  if (status) filter.status = status
  if (projectId) filter.projectId = projectId
  if (contractId) filter.contractId = contractId
  if (customerEntityId) filter.customerEntityId = customerEntityId
  if (isActive === 'true') filter.isActive = true
  if (isActive === 'false') filter.isActive = false
  if (search) {
    filter.invoiceNo = { $ilike: `%${escapeLikePattern(search)}%` }
  }

  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    orderBy[sortField] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.issuedOn = 'DESC'
  }

  const offset = (page - 1) * pageSize
  const [rows, total] = await em.findAndCount(CommercialInvoice, filter, { orderBy, limit: pageSize, offset })
  const items = rows.map(toRow)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return NextResponse.json({ items, total, page, pageSize, totalPages })
}

export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const invoiceItemSchema = z.object({
  id: z.string(),
  contractId: z.string().nullable(),
  projectId: z.string().nullable(),
  customerEntityId: z.string().nullable(),
  invoiceNo: z.string().nullable(),
  status: z.string(),
  amount: z.string(),
  currencyCode: z.string(),
  issuedOn: z.string(),
  dueDate: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.string(),
  tenantId: z.string(),
})

export const openApi = createCommercialCrudOpenApi({
  resourceName: 'CommercialInvoice',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(invoiceItemSchema),
  create: { schema: invoiceCreateSchema, description: 'Create a commercial invoice' },
  update: {
    schema: invoiceUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Update a commercial invoice',
  },
  del: {
    schema: z.object({ id: z.uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-delete a commercial invoice',
  },
})
