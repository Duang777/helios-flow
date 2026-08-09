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

  it('does not contradict the confirm-required project and commercial write tools', () => {
    expect(agent.allowedTools).toEqual(
      expect.arrayContaining([
        'projects.manage_project',
        'commercial.manage_contract',
        'commercial.manage_invoice',
        'commercial.manage_payment',
        'commercial.manage_allocation',
        'insights.manage_kpi_target',
      ]),
    )
    expect(agent.systemPrompt).toContain('confirmed mutation tools')
    expect(agent.systemPrompt).not.toContain('do not create contracts/projects')
  })

  it('keeps the fixed operating prompt regression set covered by concrete tools', () => {
    const regressionCases = [
      {
        prompt: '这个项目延期了吗？合同回款怎样，KPI 差多少，有哪些检出？',
        tools: [
          'projects.get_project',
          'projects.get_delay_summary',
          'commercial.get_project_settlement_summary',
          'insights.get_kpi_gap',
          'governance.list_findings',
        ],
      },
      {
        prompt: '列出本月逾期应收，并解释逾期金额口径。',
        tools: [
          'commercial.list_overdue_invoices',
          'commercial.list_payment_allocations',
          'commercial.get_metrics',
        ],
      },
      {
        prompt: '收入 KPI 还差目标多少？哪个组织拖后腿？',
        tools: ['insights.get_kpi_gap', 'insights.get_kpi_completion', 'commercial.get_metrics'],
      },
      {
        prompt: '看看重复客户和数据治理风险，给证据。',
        tools: ['governance.list_identity_maps', 'governance.list_findings', 'search.get_record_context'],
      },
      {
        prompt: '确认关闭这些治理检出并写处置结论。',
        tools: [
          'governance.acknowledge_finding',
          'governance.update_finding_disposition',
          'governance.acknowledge_findings',
        ],
      },
    ]

    for (const item of regressionCases) {
      expect(item.prompt.length).toBeGreaterThan(0)
      expect(agent.allowedTools).toEqual(expect.arrayContaining(item.tools))
    }
  })

  it('keeps every operating-loop write tool behind mutation approval', () => {
    const toolsByName = new Map(
      [
        ...insightsAiTools,
        ...commercialAiTools,
        ...projectsAiTools,
        ...governanceAiTools,
      ].map((tool) => [tool.name, tool]),
    )
    const writeTools = [
      'projects.manage_project',
      'commercial.manage_contract',
      'commercial.manage_invoice',
      'commercial.manage_payment',
      'commercial.manage_allocation',
      'insights.manage_kpi_target',
      'governance.acknowledge_finding',
      'governance.update_finding_disposition',
      'governance.acknowledge_findings',
    ]

    for (const toolName of writeTools) {
      expect(toolsByName.get(toolName)?.isMutation).toBe(true)
    }
  })

  it('resolvePageContext binds the current entity id and organization scope', async () => {
    const result = await agent.resolvePageContext!(
      {
        entityType: 'projects.project',
        recordId: '33333333-3333-4333-8333-333333333333',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        container: { resolve: jest.fn() } as never,
      } as Parameters<NonNullable<typeof agent.resolvePageContext>>[0],
    )

    expect(result).toContain('organizationId: org-1')
    expect(result).toContain('projectId: 33333333-3333-4333-8333-333333333333')
  })

  it('maps customer pages to customerEntityId in the page context', async () => {
    const result = await agent.resolvePageContext!(
      {
        entityType: 'customers.company',
        recordId: '44444444-4444-4444-8444-444444444444',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        container: { resolve: jest.fn() } as never,
      } as Parameters<NonNullable<typeof agent.resolvePageContext>>[0],
    )

    expect(result).toContain('customerEntityId: 44444444-4444-4444-8444-444444444444')
  })
})
