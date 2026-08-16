import type { FilterQuery } from '@mikro-orm/core'
import {
  CommercialInvoice,
  PaymentAllocation,
} from '../../../commercial/data/entities'
import { fromMoneyCents, toMoneyCents } from '../../../commercial/lib/metrics'
import type { RuleCandidate, RuleRunContext } from './upsert'

export const RULE_ALLOCATION_OVER_INVOICE = 'gov.allocation_over_invoice'

function isVoidInvoice(status: string): boolean {
  return status === 'void'
}

export async function runAllocationOverInvoiceRule(ctx: RuleRunContext): Promise<RuleCandidate[]> {
  const invoices = await ctx.em.find(
    CommercialInvoice,
    {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      deletedAt: null,
    } as FilterQuery<CommercialInvoice>,
  )

  const activeInvoices = invoices.filter((row) => !isVoidInvoice(row.status))
  if (activeInvoices.length === 0) return []

  const invoiceIds = activeInvoices.map((row) => row.id)
  const allocations = await ctx.em.find(
    PaymentAllocation,
    {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      deletedAt: null,
      invoiceId: { $in: invoiceIds },
    } as FilterQuery<PaymentAllocation>,
  )

  const allocByInvoice = new Map<string, bigint>()
  const allocIdsByInvoice = new Map<string, string[]>()
  for (const allocation of allocations) {
    const previous = allocByInvoice.get(allocation.invoiceId) ?? 0n
    allocByInvoice.set(allocation.invoiceId, previous + toMoneyCents(allocation.allocatedAmount))
    const ids = allocIdsByInvoice.get(allocation.invoiceId) ?? []
    ids.push(allocation.id)
    allocIdsByInvoice.set(allocation.invoiceId, ids)
  }

  const candidates: RuleCandidate[] = []
  for (const invoice of activeInvoices) {
    const invoiceCents = toMoneyCents(invoice.amount)
    const allocatedCents = allocByInvoice.get(invoice.id) ?? 0n
    if (allocatedCents <= invoiceCents) continue

    const overage = allocatedCents - invoiceCents
    const allocationIds = allocIdsByInvoice.get(invoice.id) ?? []
    candidates.push({
      ruleId: RULE_ALLOCATION_OVER_INVOICE,
      severity: 'critical',
      title: `Allocations exceed invoice: ${invoice.invoiceNo ?? invoice.id.slice(0, 8)}`,
      reason: `Sum of payment allocations (${fromMoneyCents(allocatedCents)}) exceeds invoice amount (${invoice.amount}).`,
      evidenceIds: [
        { type: 'invoice', id: invoice.id, module: 'commercial' },
        ...allocationIds.slice(0, 5).map((id) => ({ type: 'payment_allocation', id, module: 'commercial' })),
      ],
      subjectType: 'invoice',
      subjectId: invoice.id,
      impactSummary: `Over-allocation by ${fromMoneyCents(overage)} — legacy data integrity risk.`,
      ownerRole: 'finance_ops',
      payload: {
        invoiceAmount: invoice.amount,
        allocatedTotal: fromMoneyCents(allocatedCents),
        overage: fromMoneyCents(overage),
      },
    })
  }

  return candidates
}
