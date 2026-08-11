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
    userFeatures: ['insights.view'],
    isSuperAdmin: false,
    ...overrides,
  }
}

describe('insights explain tools', () => {
  beforeEach(() => {
    runMock.mockReset()
    createRunnerMock.mockClear()
  })

  it('insights.explain_kpi_metric lists all metrics and explains one', async () => {
    const tool = findTool('insights.explain_kpi_metric')
    const listed = (await tool.handler({}, makeCtx() as never)) as Record<string, unknown>
    expect(listed.found).toBe(true)
    expect(Array.isArray(listed.metrics)).toBe(true)
    expect((listed.metrics as Array<unknown>).length).toBe(4)
    const one = (await tool.handler({ metricKey: 'collection' }, makeCtx() as never)) as Record<string, unknown>
    expect(one.found).toBe(true)
    expect(one.scale).toBe('percent_0_100')
    expect(one.formula).toContain('collectionRate')
    expect(one.actualSource).toContain('commercial.metrics')
  })

  it('insights.suggest_kpi_actions advertises linkedMutations pointing at insights.manage_kpi_target', async () => {
    runMock.mockResolvedValueOnce({ success: true, statusCode: 200, data: { items: [], rollup: [] } })
    const tool = findTool('insights.suggest_kpi_actions')
    const result = (await tool.handler(
      { periodType: 'month', periodKey: '2026-08', organizationId: '11111111-1111-4111-8111-111111111111' },
      makeCtx() as never,
    )) as Record<string, unknown>
    const linked = result.linkedMutations as Array<Record<string, unknown>>
    expect(Array.isArray(linked)).toBe(true)
    expect(linked.length).toBeGreaterThan(0)
    const toolNames = linked.map((entry) => entry.toolName)
    // Only registered mutation tools may be advertised — never invent IDs.
    const writeToolNames = new Set(
      insightsAiTools
        .filter((entry) => entry.isMutation === true)
        .map((entry) => entry.name),
    )
    for (const name of toolNames) {
      expect(writeToolNames.has(name as string)).toBe(true)
    }
    // The proposal.metricKey + periodKey+org should map back through the argsTemplate.
    const kpiLink = linked.find((entry) => entry.toolName === 'insights.manage_kpi_target')
    expect(kpiLink).toBeDefined()
    const template = kpiLink!.argsTemplate as Record<string, unknown>
    expect(template.operation).toBe('create')
    expect(template.metricKey).toBe('${metricKey}')
    expect(template.organizationId).toBe('${organizationId}')
    expect(template.periodType).toBe('${periodType}')
    expect(template.periodKey).toBe('${periodKey}')
  })
})
