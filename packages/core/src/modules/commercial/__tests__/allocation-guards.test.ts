import { CommercialInvoice, CommercialPayment, PaymentAllocation } from '../data/entities'
import { assertAllocationWithinLimits } from '../lib/allocationGuards'

type InvoiceLike = {
  id: string
  tenantId: string
  organizationId: string
  deletedAt: null
  status: string
  currencyCode: string
  amount: string
}

type PaymentLike = {
  id: string
  tenantId: string
  organizationId: string
  deletedAt: null
  status: string
  currencyCode: string
  amount: string
}

type AllocationLike = { id: string; allocatedAmount: string }

function makeEm(opts: {
  invoice?: InvoiceLike | null
  payment?: PaymentLike | null
  allocationsByInvoice?: AllocationLike[]
  allocationsByPayment?: AllocationLike[]
}) {
  const byInvoice = opts.allocationsByInvoice ?? []
  const byPayment = opts.allocationsByPayment ?? []
  return {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === CommercialInvoice) return opts.invoice ?? null
      if (entity === CommercialPayment) return opts.payment ?? null
      return null
    }),
    find: jest.fn(async (_entity: unknown, where: Record<string, unknown>) => {
      const excludeId = (where.id as { $ne?: string } | undefined)?.$ne
      const list = where.invoiceId ? byInvoice : where.paymentId ? byPayment : []
      return list.filter((row) => !excludeId || row.id !== excludeId)
    }),
  }
}

const baseInvoice: InvoiceLike = {
  id: 'inv-1',
  tenantId: 't1',
  organizationId: 'o1',
  deletedAt: null,
  status: 'issued',
  currencyCode: 'CNY',
  amount: '100.00',
}

const basePayment: PaymentLike = {
  id: 'pay-1',
  tenantId: 't1',
  organizationId: 'o1',
  deletedAt: null,
  status: 'posted',
  currencyCode: 'CNY',
  amount: '100.00',
}

const baseParams = {
  tenantId: 't1',
  organizationId: 'o1',
  invoiceId: 'inv-1',
  paymentId: 'pay-1',
  allocatedAmount: '10.00',
}

describe('commercial allocation guard (assertAllocationWithinLimits)', () => {
  it('throws 404 when the invoice does not exist', async () => {
    const em = makeEm({ invoice: null, payment: basePayment })
    await expect(
      assertAllocationWithinLimits({ ...baseParams, em } as never),
    ).rejects.toMatchObject({ status: 404, message: expect.stringContaining('Invoice not found') })
  })

  it('rejects allocation against a void invoice', async () => {
    const em = makeEm({ invoice: { ...baseInvoice, status: 'void' }, payment: basePayment })
    await expect(
      assertAllocationWithinLimits({ ...baseParams, em } as never),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('void invoice') })
  })

  it('rejects allocation against a draft invoice', async () => {
    const em = makeEm({ invoice: { ...baseInvoice, status: 'draft' }, payment: basePayment })
    await expect(
      assertAllocationWithinLimits({ ...baseParams, em } as never),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('draft invoice') })
  })

  it('throws 404 when the payment does not exist', async () => {
    const em = makeEm({ invoice: baseInvoice, payment: null })
    await expect(
      assertAllocationWithinLimits({ ...baseParams, em } as never),
    ).rejects.toMatchObject({ status: 404, message: expect.stringContaining('Payment not found') })
  })

  it('rejects allocation against a void payment', async () => {
    const em = makeEm({ invoice: baseInvoice, payment: { ...basePayment, status: 'void' } })
    await expect(
      assertAllocationWithinLimits({ ...baseParams, em } as never),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('void payment') })
  })

  it('rejects allocation when invoice and payment currencies differ', async () => {
    const em = makeEm({ invoice: baseInvoice, payment: { ...basePayment, currencyCode: 'USD' } })
    await expect(
      assertAllocationWithinLimits({ ...baseParams, em } as never),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('currency must match') })
  })

  it('rejects when the new allocation would exceed the invoice amount', async () => {
    const em = makeEm({
      invoice: baseInvoice,
      payment: basePayment,
      allocationsByInvoice: [{ id: 'a1', allocatedAmount: '80.00' }],
    })
    await expect(
      assertAllocationWithinLimits({ ...baseParams, allocatedAmount: '30.00', em } as never),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('exceeds invoice amount') })
  })

  it('rejects when the new allocation would exceed the payment amount', async () => {
    const em = makeEm({
      invoice: baseInvoice,
      payment: basePayment,
      allocationsByPayment: [{ id: 'a1', allocatedAmount: '80.00' }],
    })
    await expect(
      assertAllocationWithinLimits({ ...baseParams, allocatedAmount: '30.00', em } as never),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('exceeds payment amount') })
  })

  it('passes when the combined allocation stays within both limits', async () => {
    const em = makeEm({
      invoice: baseInvoice,
      payment: basePayment,
      allocationsByInvoice: [{ id: 'a1', allocatedAmount: '30.00' }],
      allocationsByPayment: [{ id: 'a1', allocatedAmount: '30.00' }],
    })
    await expect(
      assertAllocationWithinLimits({ ...baseParams, allocatedAmount: '50.00', em } as never),
    ).resolves.toBeUndefined()
  })

  it('excludes the allocation being edited when updating (excludeAllocationId)', async () => {
    // The only existing allocation on the invoice is the one being updated,
    // so it must be excluded from the running total.
    const em = makeEm({
      invoice: baseInvoice,
      payment: basePayment,
      allocationsByInvoice: [{ id: 'alloc-old', allocatedAmount: '90.00' }],
    })
    await expect(
      assertAllocationWithinLimits({
        ...baseParams,
        allocatedAmount: '20.00',
        excludeAllocationId: 'alloc-old',
        em,
      } as never),
    ).resolves.toBeUndefined()
  })
})
