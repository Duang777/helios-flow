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

import projectsAiTools from '../../ai-tools/projects-pack'

function findTool(name: string) {
  const tool = projectsAiTools.find((entry) => entry.name === name)
  if (!tool) throw new Error(`tool ${name} missing`)
  return tool
}

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    userId: 'user-1',
    userFeatures: ['projects.view'],
    isSuperAdmin: false,
    ...overrides,
  }
}

describe('projects explain tools', () => {
  beforeEach(() => {
    runMock.mockReset()
    createRunnerMock.mockClear()
  })

  it('projects.explain_delay_rule returns the delay rule definition', async () => {
    const tool = findTool('projects.explain_delay_rule')
    const result = (await tool.handler({}, makeCtx() as never)) as Record<string, unknown>
    expect(result.ruleId).toBe('projects.lib.milestoneDelay')
    expect(result.formula).toContain('plannedDate')
    expect(Array.isArray(result.edgeCases)).toBe(true)
    expect(result.href).toContain('/backend/projects')
  })

  it('projects.suggest_delay_mitigation advertises linkedMutations pointing at the new manage_milestone tool', async () => {
    runMock
      .mockResolvedValueOnce({ success: true, statusCode: 200, data: { items: [], total: 0 } })
      .mockResolvedValueOnce({ success: true, statusCode: 200, data: { items: [], total: 0 } })
    const tool = findTool('projects.suggest_delay_mitigation')
    const result = (await tool.handler({}, makeCtx() as never)) as Record<string, unknown>
    const linked = result.linkedMutations as Array<Record<string, unknown>>
    expect(Array.isArray(linked)).toBe(true)
    expect(linked.length).toBeGreaterThan(0)

    const toolNames = linked.map((entry) => entry.toolName)
    const writeToolNames = new Set(
      projectsAiTools
        .filter((entry) => entry.isMutation === true)
        .map((entry) => entry.name),
    )
    // The new `projects.manage_milestone` tool must be registered AND must be
    // the target of the suggest_delay_mitigation linked chain — otherwise the
    // two-stage loop has no write sink at the projects module level.
    expect(writeToolNames.has('projects.manage_milestone')).toBe(true)
    expect(toolNames).toEqual(
      expect.arrayContaining(['projects.manage_milestone']),
    )

    // The manage_milestone link must be `update`-typed and refer to a
    // milestoneId placeholder so the LLM can copy each item from
    // `proposal.mitigations[]` into a real write call.
    const milestoneLink = linked.find((entry) => entry.toolName === 'projects.manage_milestone')
    expect(milestoneLink).toBeDefined()
    const template = milestoneLink!.argsTemplate as Record<string, unknown>
    expect(template.operation).toBe('update')
    expect(template.milestoneId).toBe('${milestoneId}')
  })

  it('projects.manage_milestone is registered as a mutation tool with the correct feature gate', () => {
    const tool = findTool('projects.manage_milestone')
    expect(tool.isMutation).toBe(true)
    expect(tool.requiredFeatures).toContain('projects.manage')
    // CRUD-style multi-operation tools must require an `operation` discriminator.
    expect(tool.tags).toEqual(expect.arrayContaining(['write', 'mutation']))
  })
})
