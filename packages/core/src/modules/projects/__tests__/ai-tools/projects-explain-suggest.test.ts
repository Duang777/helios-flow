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
  it('projects.explain_delay_rule returns the delay rule definition', async () => {
    const tool = findTool('projects.explain_delay_rule')
    const result = (await tool.handler({}, makeCtx() as never)) as Record<string, unknown>
    expect(result.ruleId).toBe('projects.lib.milestoneDelay')
    expect(result.formula).toContain('plannedDate')
    expect(Array.isArray(result.edgeCases)).toBe(true)
    expect(result.href).toContain('/backend/projects')
  })
})
