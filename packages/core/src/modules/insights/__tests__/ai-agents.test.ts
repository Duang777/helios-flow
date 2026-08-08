jest.mock('@helios/shared/lib/logger', () => {
  const mocked = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(),
  }
  mocked.child.mockImplementation(() => mocked)
  return { createLogger: jest.fn(() => mocked) }
})

import aiAgents from '../ai-agents'
import insightsAiTools from '../ai-tools'
import commercialAiTools from '../../commercial/ai-tools'
import projectsAiTools from '../../projects/ai-tools'
import governanceAiTools from '../../governance/ai-tools'

const GENERAL_PURPOSE_TOOLS = new Set([
  'search.hybrid_search',
  'search.get_record_context',
  'meta.describe_agent',
])

describe('insights.operating_loop_assistant agent definition', () => {
  const agent = aiAgents.find((entry) => entry.id === 'insights.operating_loop_assistant')!

  it('is exported alongside the KPI assistant', () => {
    expect(aiAgents.map((entry) => entry.id).sort()).toEqual([
      'insights.kpi_assistant',
      'insights.operating_loop_assistant',
    ])
    expect(agent.moduleId).toBe('insights')
  })

  it('declares confirm-required because it can acknowledge governance findings', () => {
    expect(agent.readOnly).toBe(false)
    expect(agent.mutationPolicy).toBe('confirm-required')
    expect(agent.allowedTools).toContain('governance.acknowledge_finding')
    expect(agent.allowedTools).toContain('governance.update_finding_disposition')
    expect(agent.allowedTools).toContain('governance.acknowledge_findings')
  })

  it('enables visible task plans without manually whitelisting meta.update_task_plan', () => {
    expect(agent.taskPlan).toEqual({ enabled: true })
    expect(agent.allowedTools).not.toContain('meta.update_task_plan')
  })

  it('only whitelists registered operating-loop tools plus general tools', () => {
    const registered = new Set([
      ...insightsAiTools.map((tool) => tool.name),
      ...commercialAiTools.map((tool) => tool.name),
      ...projectsAiTools.map((tool) => tool.name),
      ...governanceAiTools.map((tool) => tool.name),
    ])
    for (const toolName of agent.allowedTools) {
      expect(registered.has(toolName) || GENERAL_PURPOSE_TOOLS.has(toolName)).toBe(true)
    }
  })

  it('prompt forces evidence, formula source, and links in answers', () => {
    expect(agent.systemPrompt).toContain('formula source')
    expect(agent.systemPrompt).toContain('href')
    expect(agent.systemPrompt).toContain('evidence IDs')
    expect(agent.systemPrompt).toContain('Do not claim you updated data until the approval card is confirmed')
  })
})
