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

import insightsAiTools from '../../ai-tools'
import features from '../../acl'

const knownFeatureIds = new Set(features.map((entry) => entry.id))

function findTool(name: string) {
  const tool = insightsAiTools.find((entry) => entry.name === name)
  if (!tool) throw new Error(`tool ${name} missing`)
  return tool
}

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    userId: 'user-1',
    container: { resolve: jest.fn() },
    userFeatures: ['insights.view'],
    isSuperAdmin: false,
    ...overrides,
  }
}

describe('insights.get_kpi_gap', () => {
  beforeEach(() => {
    runMock.mockReset()
    createRunnerMock.mockClear()
  })

  it('declares an existing view feature and validates period input', () => {
    const tool = findTool('insights.get_kpi_gap')
    expect(tool.requiredFeatures).toEqual(['insights.view'])
    for (const feature of tool.requiredFeatures ?? []) expect(knownFeatureIds.has(feature)).toBe(true)
    expect(tool.inputSchema.safeParse({ periodType: 'year', periodKey: '2026' }).success).toBe(true)
    expect(tool.inputSchema.safeParse({ periodType: 'week', periodKey: '2026-W01' }).success).toBe(false)
  })

  it('maps completion rows to target gaps and dragged organization rows', async () => {
    const tool = findTool('insights.get_kpi_gap')
    runMock.mockResolvedValue({
      success: true,
      statusCode: 200,
      data: {
        items: [
          {
            organizationId: 'org-child-a',
            metricKey: 'revenue',
            targetValue: '100.00',
            actualValue: '75.00',
            completionRate: '75.00',
            unit: 'amount',
            currencyCode: 'CNY',
            actualSource: 'commercial.metrics',
          },
          {
            organizationId: 'org-child-b',
            metricKey: 'revenue',
            targetValue: '100.00',
            actualValue: '120.00',
            completionRate: '120.00',
            unit: 'amount',
            currencyCode: 'CNY',
            actualSource: 'commercial.metrics',
          },
        ],
        rollup: [],
        asOf: '2026-08-31',
        periodType: 'year',
        periodKey: '2026',
      },
    })

    const result = (await tool.handler(
      { periodType: 'year', periodKey: '2026', includeDescendants: true },
      makeCtx() as never,
    )) as Record<string, unknown>

    expect(runMock.mock.calls[0][0]).toMatchObject({
      method: 'GET',
      path: '/insights/kpi/completion',
      query: {
        organizationId: 'org-1',
        periodType: 'year',
        periodKey: '2026',
        includeDescendants: 'true',
      },
    })
    const rows = result.rows as Array<Record<string, unknown>>
    expect(rows[0]).toMatchObject({
      organizationId: 'org-child-a',
      metricKey: 'revenue',
      gapToTarget: '25.000000',
      status: 'behind',
    })
    const dragged = result.draggedOrganizations as Array<Record<string, unknown>>
    expect(dragged.map((entry) => entry.organizationId)).toEqual(['org-child-a'])
    expect(result.formulaSource).toContain('completionRate = actualValue ÷ targetValue')
  })
})
