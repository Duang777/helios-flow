import integrationsAiTools from '../ai-tools'

describe('integrations AI tools', () => {
  it('exports credential-free list and get tools', () => {
    expect(integrationsAiTools.map((tool) => tool.name)).toEqual([
      'integrations.list_integrations',
      'integrations.get_integration',
    ])
    for (const tool of integrationsAiTools) {
      expect(tool.isMutation).not.toBe(true)
      expect(tool.description.toLowerCase()).toContain('never returns credentials')
    }
  })
})
