const emFindMock = jest.fn()

jest.mock(
  '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner',
  () => ({
    ...jest.requireActual('@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'),
    createAiApiOperationRunner: jest.fn(() => ({ run: jest.fn() })),
  }),
)

import governanceAiTools from '../../ai-tools'

function findTool(name: string) {
  const tool = governanceAiTools.find((entry) => entry.name === name)
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
        if (name === 'em') return { find: emFindMock, findOne: emFindMock }
        throw new Error(`unexpected resolve: ${name}`)
      }),
    },
    userFeatures: ['governance.view'],
    isSuperAdmin: false,
    ...overrides,
  }
}

describe('governance explain + suggest tools', () => {
  beforeEach(() => emFindMock.mockReset())

  it('governance.explain_rule lists all rules and explains one', async () => {
    const tool = findTool('governance.explain_rule')
    const listed = (await tool.handler({}, makeCtx() as never)) as Record<string, unknown>
    expect(listed.found).toBe(true)
    expect((listed.rules as Array<unknown>).length).toBe(9)
    const one = (await tool.handler(
      { ruleId: 'gov.project_milestone_delayed' },
      makeCtx() as never,
    )) as Record<string, unknown>
    expect(one.found).toBe(true)
    expect((one.rule as Record<string, unknown>).severity).toBe('warning')
    expect((one.rule as Record<string, unknown>).trigger).toContain('cancelled')
  })

  it('governance.explain_rule enforces tenant + organization scope (privilege boundary)', async () => {
    const tool = findTool('governance.explain_rule')
    await expect(tool.handler({}, makeCtx({ tenantId: null }) as never)).rejects.toThrow(
      /require tenant and organization scope/,
    )
    await expect(tool.handler({}, makeCtx({ organizationId: null }) as never)).rejects.toThrow(
      /require tenant and organization scope/,
    )
  })

  it('governance.suggest_disposition returns context and schema for a finding', async () => {
    emFindMock.mockResolvedValueOnce({
      id: '11111111-1111-4111-8111-111111111111',
      ruleId: 'gov.project_milestone_delayed',
      severity: 'warning',
      ownerRole: 'project_manager',
      impactSummary: 'Delivery milestone is overdue.',
      evidenceIds: [],
      status: 'open',
    })
    const tool = findTool('governance.suggest_disposition')
    const result = (await tool.handler(
      { findingId: '11111111-1111-4111-8111-111111111111' },
      makeCtx() as never,
    )) as Record<string, unknown>
    expect(result.found).toBe(true)
    expect((result.context as Record<string, unknown>).ruleId).toBe('gov.project_milestone_delayed')
    expect(result.outputSchemaDescriptor).toBeDefined()
    expect((result.outputSchemaDescriptor as Record<string, unknown>).schemaName).toBe(
      'GovernanceDispositionSuggestion',
    )
  })
})
