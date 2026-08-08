const runMock = jest.fn()
const createRunnerMock = jest.fn(() => ({ run: runMock }))

jest.mock(
  '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner',
  () => {
    const actual = jest.requireActual(
      '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner',
    )
    return {
      ...actual,
      createAiApiOperationRunner: (...args: unknown[]) => createRunnerMock(...args),
    }
  },
)

import commercialAiTools from '../../ai-tools/commercial-pack'
import features from '../../acl'

const knownFeatureIds = new Set(features.map((entry) => entry.id))

function findTool(name: string) {
  const tool = commercialAiTools.find((entry) => entry.name === name)
  if (!tool) throw new Error(`tool ${name} missing`)
  return tool
}

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    userId: 'user-1',
    container: {
      resolve: jest.fn((name: string) => {
        throw new Error(`unexpected resolve: ${name}`)
      }),
    },
    userFeatures: ['commercial.view'],
    isSuperAdmin: false,
    ...overrides,
  }
}

describe('commercial AI tools', () => {
  beforeEach(() => {
    runMock.mockReset()
    createRunnerMock.mockClear()
  })

  it('exports the operating-loop read tools with existing ACL features', () => {
    const toolNames = commercialAiTools.map((tool) => tool.name)
    expect(toolNames).toEqual(
      expect.arrayContaining([
        'commercial.list_overdue_invoices',
        'commercial.list_payment_allocations',
        'commercial.get_project_settlement_summary',
      ]),
    )
    for (const tool of commercialAiTools) {
      for (const feature of tool.requiredFeatures ?? []) {
        expect(knownFeatureIds.has(feature)).toBe(true)
      }
    }
  })

  it('commercial.list_payment_allocations delegates invoice filters to the API runner', async () => {
    const tool = findTool('commercial.list_payment_allocations')
    runMock.mockResolvedValue({
      success: true,
      statusCode: 200,
      data: {
        items: [
          {
            id: 'alloc-1',
            invoiceId: '11111111-1111-4111-8111-111111111111',
            paymentId: '22222222-2222-4222-8222-222222222222',
            allocatedAmount: '80.00',
            allocatedOn: '2026-08-01',
          },
        ],
        total: 1,
      },
    })

    const result = (await tool.handler(
      { invoiceId: '11111111-1111-4111-8111-111111111111', limit: 20 },
      makeCtx() as never,
    )) as Record<string, unknown>

    expect(runMock).toHaveBeenCalledTimes(1)
    expect(runMock.mock.calls[0][0]).toMatchObject({
      method: 'GET',
      path: '/commercial/allocations',
      query: { invoiceId: '11111111-1111-4111-8111-111111111111', page: 1, pageSize: 20 },
    })
    const items = result.items as Array<Record<string, unknown>>
    expect(items[0]).toMatchObject({
      id: 'alloc-1',
      invoiceId: '11111111-1111-4111-8111-111111111111',
      allocatedAmount: '80.00',
      href: '/backend/commercial/allocations/alloc-1',
    })
  })

  it('commercial.get_project_settlement_summary calls metrics with organization and project scope', async () => {
    const tool = findTool('commercial.get_project_settlement_summary')
    runMock.mockResolvedValue({
      success: true,
      statusCode: 200,
      data: {
        actualRevenue: '100.00',
        overdueOutstanding: '30.00',
        definitions: {
          overdueOutstanding: {
            formula: 'Σ overdue outstanding',
            sources: ['commercial_invoices', 'payment_allocations'],
          },
        },
      },
    })

    const result = (await tool.handler(
      {
        projectId: '33333333-3333-4333-8333-333333333333',
        asOf: '2026-08-31',
      },
      makeCtx() as never,
    )) as Record<string, unknown>

    expect(runMock.mock.calls[0][0]).toMatchObject({
      method: 'GET',
      path: '/commercial/metrics',
      query: {
        organizationId: 'org-1',
        projectId: '33333333-3333-4333-8333-333333333333',
        asOf: '2026-08-31',
      },
    })
    expect(result.projectId).toBe('33333333-3333-4333-8333-333333333333')
    expect(result.hrefs).toEqual({
      project: '/backend/projects/33333333-3333-4333-8333-333333333333',
      commercial: '/backend/commercial',
    })
    expect(result.metrics).toMatchObject({ actualRevenue: '100.00' })
  })

  it('commercial.list_overdue_invoices returns only issued invoices with outstanding overdue balances', async () => {
    const tool = findTool('commercial.list_overdue_invoices')
    const em = {
      find: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'inv-1',
            invoiceNo: 'INV-1',
            projectId: '33333333-3333-4333-8333-333333333333',
            contractId: null,
            customerEntityId: null,
            amount: '100.00',
            currencyCode: 'CNY',
            dueDate: '2026-08-01',
            status: 'issued',
          },
          {
            id: 'inv-2',
            invoiceNo: 'INV-2',
            projectId: null,
            contractId: null,
            customerEntityId: null,
            amount: '50.00',
            currencyCode: 'CNY',
            dueDate: '2026-08-02',
            status: 'issued',
          },
        ])
        .mockResolvedValueOnce([
          { invoiceId: 'inv-1', allocatedAmount: '30.00' },
          { invoiceId: 'inv-2', allocatedAmount: '50.00' },
        ]),
    }
    const ctx = makeCtx({
      container: {
        resolve: jest.fn((name: string) => {
          if (name === 'em') return em
          throw new Error(`unexpected resolve: ${name}`)
        }),
      },
    })

    const result = (await tool.handler(
      { asOf: '2026-08-31' },
      ctx as never,
    )) as Record<string, unknown>

    const items = result.items as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'inv-1',
      outstandingAmount: '70.00',
      overdueDays: 30,
      href: '/backend/commercial/invoices/inv-1',
    })
    expect(result.formulaSource).toContain('commercial_invoices')
  })
})
