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
import customersAiTools from '../../customers/ai-tools'
import catalogAiTools from '../../catalog/ai-tools'
import salesAiTools from '../../sales/ai-tools'
import workflowsAiTools from '../../workflows/ai-tools'
import wmsAiTools from '../../wms/ai-tools'
import integrationsAiTools from '../../integrations/ai-tools'
import inboxOpsAiTools from '../../inbox_ops/ai-tools'

const GENERAL_PURPOSE_TOOLS = new Set([
  'search.hybrid_search',
  'search.get_record_context',
  'attachments.list_record_attachments',
  'attachments.read_attachment',
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
      ...customersAiTools.map((tool) => tool.name),
      ...catalogAiTools.map((tool) => tool.name),
      ...salesAiTools.map((tool) => tool.name),
      ...workflowsAiTools.map((tool) => tool.name),
      ...wmsAiTools.map((tool) => tool.name),
      ...integrationsAiTools.map((tool) => tool.name),
      ...inboxOpsAiTools.map((tool) => tool.name),
    ])
    for (const toolName of agent.allowedTools) {
      expect(registered.has(toolName) || GENERAL_PURPOSE_TOOLS.has(toolName)).toBe(true)
    }
  })

  it('prompt forces evidence, formula source, and links in answers', () => {
    expect(agent.systemPrompt).toContain('formula source')
    expect(agent.systemPrompt).toContain('href')
    expect(agent.systemPrompt).toContain('evidence IDs')
    expect(agent.systemPrompt).toContain('starts with `证据:` or `Evidence:`')
    expect(agent.systemPrompt).toContain('Do not claim you updated data until the approval card is confirmed')
  })

  it('routes fixed Chinese operating prompts to the required tool families', () => {
    expect(agent.systemPrompt).toContain('逾期应收')
    expect(agent.systemPrompt).toContain('commercial.list_overdue_invoices')
    expect(agent.systemPrompt).toContain('commercial.explain_metric')
    expect(agent.systemPrompt).toContain('governance.suggest_disposition')
    expect(agent.systemPrompt).toContain('projects.get_delay_summary')
    expect(agent.systemPrompt).toContain('customers.list_')
    expect(agent.systemPrompt).toContain('sales.list_orders')
    expect(agent.systemPrompt).toContain('catalog.search_products')
    expect(agent.systemPrompt).toContain('wms.list_balances')
    expect(agent.systemPrompt).toContain('workflows.list_tasks')
    expect(agent.systemPrompt).toContain('inbox_ops_list_proposals')
    expect(agent.systemPrompt).toContain('inbox_ops_accept_action')
    expect(agent.systemPrompt).toContain('integrations.list_integrations')
    expect(agent.systemPrompt).toContain('Treat returned invoice ids, payment ids, and allocation ids as evidence IDs')
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
        'customers.update_deal_stage',
        'sales.manage_order',
        'sales.list_orders',
        'catalog.get_product',
        'wms.list_balances',
        'workflows.complete_task',
        'integrations.list_integrations',
        'inbox_ops_list_proposals',
        'inbox_ops_accept_action',
      ]),
    )
    expect(agent.allowedTools).not.toContain('inbox_ops_categorize_email')
    expect(agent.systemPrompt).toContain('confirmed mutation tools')
    expect(agent.systemPrompt).not.toContain('do not create contracts/projects')
  })

  it('keeps the fixed operating prompt regression set covered by concrete tools', () => {
    const regressionCases = [
      {
        prompt: '这个客户的商机和订单怎么样，项目延期了吗，合同回款和 KPI、治理检出如何？',
        tools: [
          'customers.get_company',
          'customers.list_deals',
          'sales.list_orders',
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
      {
        prompt: '列出待处理收件箱提案，接受 pending 动作前必须走确认卡。',
        tools: ['inbox_ops_list_proposals', 'inbox_ops_get_proposal', 'inbox_ops_accept_action'],
      },
      {
        prompt: '列出当前订单，改状态需要确认写入。',
        tools: ['sales.list_orders', 'sales.manage_order'],
      },
      {
        prompt: '当前库存余额怎样？不要做收货或调整。',
        tools: ['wms.list_balances'],
      },
      {
        prompt: '有哪些待办工作流任务？认领或完成必须走确认卡。',
        tools: ['workflows.list_tasks', 'workflows.claim_task', 'workflows.complete_task'],
      },
      {
        prompt: '集成连接器健康状况如何？不要输出凭据。',
        tools: ['integrations.list_integrations'],
      },
      {
        prompt: '列出当前客户公司，给出后台链接。',
        tools: ['customers.list_companies'],
      },
      {
        prompt: '查一下现有商品，给出 SKU 和后台链接。',
        tools: ['catalog.search_products', 'catalog.list_products'],
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
        ...customersAiTools,
        ...salesAiTools,
        ...workflowsAiTools,
        ...inboxOpsAiTools,
      ].map((tool) => [tool.name, tool]),
    )
    const writeTools = [
      'projects.manage_project',
      'commercial.manage_contract',
      'commercial.manage_invoice',
      'commercial.manage_payment',
      'commercial.manage_allocation',
      'insights.manage_kpi_target',
      'customers.update_deal_stage',
      'sales.manage_order',
      'sales.manage_quote',
      'workflows.claim_task',
      'workflows.complete_task',
      'inbox_ops_accept_action',
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

  it('resolvePageContext preserves list table filters and scoped ids', async () => {
    const result = await agent.resolvePageContext!(
      {
        entityType: 'commercial.invoice',
        recordId: '',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        tableId: 'commercial.invoices.list',
        visibleFilters: { status: 'issued' },
        extra: { projectId: 'project-1', contractId: 'contract-1' },
        selectedRecordIds: ['invoice-1'],
        page: 2,
        pageSize: 50,
        totalMatching: 7,
        container: { resolve: jest.fn() } as never,
      } as Parameters<NonNullable<typeof agent.resolvePageContext>>[0],
    )

    expect(result).toContain('tableId: commercial.invoices.list')
    expect(result).toContain('visibleFilters: {"status":"issued"}')
    expect(result).toContain('scopedIds: {"projectId":"project-1","contractId":"contract-1"}')
    expect(result).toContain('selectedRecordIds: invoice-1')
    expect(result).toContain('totalMatching: 7')
  })
})
