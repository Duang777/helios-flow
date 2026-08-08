import type { FilterQuery } from '@mikro-orm/core'
import {
  CommercialInvoice,
  PaymentAllocation,
} from '../../../commercial/data/entities'
import { fromMoneyCents, isOperatingInvoiceStatus, toMoneyCents } from '../../../commercial/lib/metrics'
import type { RuleCandidate, RuleRunContext } from './upsert'

export const RULE_INVOICE_OVERDUE_OUTSTANDING = 'gov.invoice_overdue_outstanding'

export async function runInvoiceOverdueOutstandingRule(ctx: RuleRunContext): Promise<RuleCandidate[]> {
  const invoices = await ctx.em.find(
    CommercialInvoice,
    {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      deletedAt: null,
    } as FilterQuery<CommercialInvoice>,
  )

  const activeInvoices = invoices.filter((row) => isOperatingInvoiceStatus(row.status))
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
  for (const allocation of allocations) {
    const previous = allocByInvoice.get(allocation.invoiceId) ?? 0n
    allocByInvoice.set(allocation.invoiceId, previous + toMoneyCents(allocation.allocatedAmount))
  }

  const candidates: RuleCandidate[] = []
  for (const invoice of activeInvoices) {
    if (!invoice.dueDate || invoice.dueDate >= ctx.asOf) continue
    const invoiceCents = toMoneyCents(invoice.amount)
    const allocatedCents = allocByInvoice.get(invoice.id) ?? 0n
    const remainder = invoiceCents - allocatedCents
    if (remainder <= 0n) continue

    candidates.push({
      ruleId: RULE_INVOICE_OVERDUE_OUTSTANDING,
      severity: 'warning',
      title: `Overdue invoice outstanding: ${invoice.invoiceNo ?? invoice.id.slice(0, 8)}`,
      reason: `Invoice due ${invoice.dueDate} has ${fromMoneyCents(remainder)} outstanding as of ${ctx.asOf}.`,
      evidenceIds: [
        { type: 'invoice', id: invoice.id, module: 'commercial' },
        ...(invoice.projectId
          ? [{ type: 'project', id: invoice.projectId, module: 'projects' as const }]
          : []),
      ],
      subjectType: 'invoice',
      subjectId: invoice.id,
      impactSummary: 'Accounts receivable remains open past due date.',
      ownerRole: 'finance_ops',
      suggestedDueOn: invoice.dueDate,
      payload: {
        dueDate: invoice.dueDate,
        outstandingAmount: fromMoneyCents(remainder),
        invoiceAmount: invoice.amount,
      },
    })
  }

  return candidates
}
