import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@helios/shared/lib/crud/factory'
import { CommercialContract } from '../../data/entities'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@helios/shared/lib/auth/server'
import { createRequestContainer } from '@helios/shared/lib/di/container'
import { escapeLikePattern } from '@helios/shared/lib/db/escapeLikePattern'
import { contractCreateSchema, contractUpdateSchema } from '../../data/validators'
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
    entity: CommercialContract,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'commercial',
    entity: 'contract',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'commercial.contracts.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.contractId) }),
      status: 201,
    },
    update: {
      commandId: 'commercial.contracts.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'commercial.contracts.delete',
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
    sortField: z.enum(['name', 'status', 'amount', 'createdAt', 'updatedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    status: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
    projectId: z.uuid().optional(),
    contractId: z.uuid().optional(),
    customerEntityId: z.uuid().optional(),
  })
  .loose()

type ContractRow = {
  id: string
  name: string
  code: string | null
  status: string
  contractType: string
  customerEntityId: string | null
  projectId: string | null
  dealId: string | null
  amount: string
  currencyCode: string
  startDate: string | null
  endDate: string | null
  paymentTerms: string | null
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (contract: CommercialContract): ContractRow => ({
  id: String(contract.id),
  name: String(contract.name),
  code: contract.code ?? null,
  status: String(contract.status),
  contractType: String(contract.contractType),
  customerEntityId: contract.customerEntityId ?? null,
  projectId: contract.projectId ?? null,
  dealId: contract.dealId ?? null,
  amount: String(contract.amount),
  currencyCode: String(contract.currencyCode),
  startDate: contract.startDate ?? null,
  endDate: contract.endDate ?? null,
  paymentTerms: contract.paymentTerms ?? null,
  isActive: !!contract.isActive,
  createdAt: contract.createdAt ? contract.createdAt.toISOString() : null,
  updatedAt: contract.updatedAt ? contract.updatedAt.toISOString() : null,
  organizationId: String(contract.organizationId),
  tenantId: String(contract.tenantId),
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
    projectId: url.searchParams.get('projectId') ?? undefined,
    contractId: url.searchParams.get('contractId') ?? undefined,
    customerEntityId: url.searchParams.get('customerEntityId') ?? undefined,
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
    isActive,
    projectId,
    contractId,
    customerEntityId,
  } = parsed.data

  const filter: FilterQuery<CommercialContract> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) filter.organizationId = auth.orgId
  if (id) filter.id = id
  if (contractId) filter.id = contractId
  if (status) filter.status = status
  if (projectId) filter.projectId = projectId
  if (customerEntityId) filter.customerEntityId = customerEntityId
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
  const [rows, total] = await em.findAndCount(CommercialContract, filter, { orderBy, limit: pageSize, offset })
  const items = rows.map(toRow)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return NextResponse.json({ items, total, page, pageSize, totalPages })
}

export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const contractItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  status: z.string(),
  contractType: z.string(),
  customerEntityId: z.string().nullable(),
  projectId: z.string().nullable(),
  dealId: z.string().nullable(),
  amount: z.string(),
  currencyCode: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  paymentTerms: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.string(),
  tenantId: z.string(),
})

export const openApi = createCommercialCrudOpenApi({
  resourceName: 'CommercialContract',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(contractItemSchema),
  create: { schema: contractCreateSchema, description: 'Create a commercial contract' },
  update: {
    schema: contractUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Update a commercial contract',
  },
  del: {
    schema: z.object({ id: z.uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-delete a commercial contract',
  },
})
