import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@helios/shared/lib/crud/errors'
import { CommercialInvoice, CommercialPayment, PaymentAllocation } from '../data/entities'
import { sumMoneyCents, toMoneyCents } from './metrics'

type AllocationGuardParams = {
  em: EntityManager
  tenantId: string
  organizationId: string
  invoiceId: string
  paymentId: string
  allocatedAmount: string
  excludeAllocationId?: string
}

async function sumExistingAllocations(
  em: EntityManager,
  filter: {
    tenantId: string
    organizationId: string
    invoiceId?: string
    paymentId?: string
    excludeAllocationId?: string
  },
): Promise<bigint> {
  const where: Record<string, unknown> = {
    tenantId: filter.tenantId,
    organizationId: filter.organizationId,
    deletedAt: null,
  }
  if (filter.invoiceId) where.invoiceId = filter.invoiceId
  if (filter.paymentId) where.paymentId = filter.paymentId
  if (filter.excludeAllocationId) where.id = { $ne: filter.excludeAllocationId }

  const rows = await em.find(PaymentAllocation, where)
  return sumMoneyCents(rows.map((row) => row.allocatedAmount))
}

export async function assertAllocationWithinLimits(params: AllocationGuardParams): Promise<void> {
  const { em, tenantId, organizationId, invoiceId, paymentId, allocatedAmount, excludeAllocationId } =
    params

  const invoice = await em.findOne(CommercialInvoice, {
    id: invoiceId,
    tenantId,
    organizationId,
    deletedAt: null,
  })
  if (!invoice) throw new CrudHttpError(404, { error: 'Invoice not found' })
  if (invoice.status === 'void') {
    throw new CrudHttpError(400, { error: 'Cannot allocate against a void invoice' })
  }
  if (invoice.status === 'draft') {
    throw new CrudHttpError(400, { error: 'Cannot allocate against a draft invoice' })
  }

  const payment = await em.findOne(CommercialPayment, {
    id: paymentId,
    tenantId,
    organizationId,
    deletedAt: null,
  })
  if (!payment) throw new CrudHttpError(404, { error: 'Payment not found' })
  if (payment.status === 'void') {
    throw new CrudHttpError(400, { error: 'Cannot allocate against a void payment' })
  }
  if (payment.status === 'draft') {
    throw new CrudHttpError(400, { error: 'Cannot allocate against a draft payment' })
  }

  if (invoice.currencyCode !== payment.currencyCode) {
    throw new CrudHttpError(400, { error: 'Invoice and payment currency must match' })
  }

  const newCents = toMoneyCents(allocatedAmount)
  const invoiceAllocated = await sumExistingAllocations(em, {
    tenantId,
    organizationId,
    invoiceId,
    excludeAllocationId,
  })
  const paymentAllocated = await sumExistingAllocations(em, {
    tenantId,
    organizationId,
    paymentId,
    excludeAllocationId,
  })

  const invoiceLimit = toMoneyCents(invoice.amount)
  const paymentLimit = toMoneyCents(payment.amount)

  if (invoiceAllocated + newCents > invoiceLimit) {
    throw new CrudHttpError(400, { error: 'Total allocation exceeds invoice amount' })
  }
  if (paymentAllocated + newCents > paymentLimit) {
    throw new CrudHttpError(400, { error: 'Total allocation exceeds payment amount' })
  }
}
