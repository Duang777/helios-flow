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
})
