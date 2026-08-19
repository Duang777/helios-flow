import workflowsAiTools from '../ai-tools'

describe('workflows AI tools', () => {
  it('exports instance/task reads plus confirm-required claim and complete', () => {
    expect(workflowsAiTools.map((tool) => tool.name)).toEqual([
      'workflows.list_instances',
      'workflows.get_instance',
      'workflows.list_tasks',
      'workflows.get_task',
      'workflows.claim_task',
      'workflows.complete_task',
    ])
    expect(workflowsAiTools.filter((tool) => tool.isMutation).map((tool) => tool.name)).toEqual([
      'workflows.claim_task',
      'workflows.complete_task',
    ])
  })
})
