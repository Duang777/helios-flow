const runMock = jest.fn()

jest.mock(
  '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner',
  () => ({
    ...jest.requireActual('@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'),
    createAiApiOperationRunner: jest.fn(() => ({ run: runMock })),
  }),
)

import writePackTools from '../ai-tools/write-pack'

function findTool(name: string) {
  const tool = writePackTools.find((entry) => entry.name === name)
  if (!tool) throw new Error(`tool ${name} missing`)
  return tool
}

function makeEm(opts: {
  invoice?: Record<string, unknown> | null
  payment?: Record<string, unknown> | null
  allocationsByInvoice?: Array<Record<string, unknown>>
}) {
  const byInvoice = opts.allocationsByInvoice ?? []
  return {
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity && (entity as { name?: string }).name === 'CommercialInvoice') return opts.invoice ?? null
      if (entity && (entity as { name?: string }).name === 'CommercialPayment') return opts.payment ?? null
      // Allocation lookup (after a successful create) — return the stored row if id matches.
      return byInvoice.find((row) => row.id === where.id) ?? null
    }),
    find: jest.fn(async (_entity: unknown, where: Record<string, unknown>) => {
      const excludeId = (where.id as { $ne?: string } | undefined)?.$ne
      return byInvoice.filter((row) => !excludeId || row.id !== excludeId)
    }),
  }
}

function makeCtx(em: unknown, overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 't1',
    organizationId: 'o1',
    userId: 'u1',
    container: {
      resolve: jest.fn((name: string) => {
        if (name === 'em') return em
        throw new Error(`unexpected resolve: ${name}`)
      }),
    },
    userFeatures: ['commercial.manage'],
    isSuperAdmin: false,
    ...overrides,
  }
}

const invoiceRow = {
  id: 'inv-1',
  tenantId: 't1',
  organizationId: 'o1',
  deletedAt: null,
  status: 'issued',
  currencyCode: 'CNY',
  amount: '100.00',
}

const paymentRow = {
  id: 'pay-1',
  tenantId: 't1',
  organizationId: 'o1',
  deletedAt: null,
  status: 'posted',
  currencyCode: 'CNY',
  amount: '100.00',
}

describe('commercial write tools (manage_*)', () => {
  beforeEach(() => {
    runMock.mockReset()
    runMock.mockResolvedValue({ success: true, statusCode: 201, data: { id: 'alloc-new' } })
  })

  const invoiceId = '11111111-1111-4111-8111-111111111111'
  const paymentId = '22222222-2222-4222-8222-222222222222'

  it('commercial.manage_allocation blocks an over-allocation before persisting', async () => {
    const em = makeEm({
      invoice: invoiceRow,
      payment: paymentRow,
      allocationsByInvoice: [{ id: 'a1', allocatedAmount: '80.00' }],
    })
    const tool = findTool('commercial.manage_allocation')
    await expect(
      tool.handler(
        {
          operation: 'create',
          invoiceId,
          paymentId,
          allocatedAmount: '30.00',
        },
        makeCtx(em) as never,
      ),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('exceeds invoice amount') })
    // The guard must reject before any API write happens.
    expect(runMock).not.toHaveBeenCalled()
  })

  it('commercial.manage_allocation creates when within limits and calls the allocations API', async () => {
    const em = makeEm({
      invoice: invoiceRow,
      payment: paymentRow,
      allocationsByInvoice: [{ id: 'a1', allocatedAmount: '30.00' }],
    })
    const tool = findTool('commercial.manage_allocation')
    const result = (await tool.handler(
      {
        operation: 'create',
        invoiceId,
        paymentId,
        allocatedAmount: '50.00',
      },
      makeCtx(em) as never,
    )) as Record<string, unknown>

    expect(result.commandName).toBe('commercial.allocations.create')
    expect(result.allocationId).toBe('alloc-new')
    expect(runMock).toHaveBeenCalledTimes(1)
    expect(runMock.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      path: '/commercial/allocations',
    })
  })

  it('commercial.manage_contract create rejects when organization scope is missing', async () => {
    const em = makeEm({ invoice: invoiceRow, payment: paymentRow })
    const tool = findTool('commercial.manage_contract')
    await expect(
      tool.handler(
        { operation: 'create', name: 'New contract', amount: '10.00' },
        makeCtx(em, { organizationId: null }) as never,
      ),
    ).rejects.toThrow(/Organization scope is required/)
    expect(runMock).not.toHaveBeenCalled()
  })
})
