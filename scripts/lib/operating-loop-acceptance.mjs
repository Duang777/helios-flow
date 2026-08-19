export const OPERATING_LOOP_AGENT_ID = 'insights.operating_loop_assistant'

export const OPERATING_LOOP_REQUIRED_TOOLS = [
  'projects.get_delay_summary',
  'commercial.get_project_settlement_summary',
  'insights.get_kpi_gap',
  'governance.list_findings',
]

export const OPERATING_LOOP_ACCEPTANCE_PROMPTS = [
  {
    id: 'zh_project_loop',
    prompt:
      '这个项目延期了吗？合同回款怎样？KPI 差多少？有哪些治理检出？请给出数字、公式来源、证据 ID 和后台链接。',
    requiredTools: OPERATING_LOOP_REQUIRED_TOOLS,
    requiredMarkers: ['延期', '回款', 'KPI', '治理'],
  },
  {
    id: 'zh_overdue_ar',
    prompt:
      '列出当前逾期应收，说明逾期未回金额怎么算，并给出可以打开的后台链接。',
    requiredTools: ['commercial.list_overdue_invoices', 'commercial.explain_metric'],
    requiredMarkers: ['逾期', '应收', '公式'],
  },
  {
    id: 'zh_governance_disposition',
    prompt:
      '有哪些 critical 治理检出？解释触发规则、证据 ID、负责人角色，并给出处置建议。',
    requiredTools: ['governance.list_findings', 'governance.explain_rule', 'governance.suggest_disposition'],
    requiredMarkers: ['critical', '证据', '负责人'],
  },
  {
    id: 'zh_project_page_context',
    prompt:
      '基于当前项目页上下文，告诉我这个项目现在最大的经营风险是什么，按延期、回款、KPI、治理检出顺序回答。',
    requiredTools: [
      'projects.get_delay_summary',
      'commercial.get_project_settlement_summary',
      'insights.get_kpi_gap',
      'governance.list_findings',
    ],
    requiredMarkers: ['项目', '延期', '回款', 'KPI', '治理'],
  },
  {
    id: 'zh_collection_action_suggestion',
    prompt:
      '针对逾期应收给出催收动作建议，并说明如果要登记回款或核销，需要走哪些确认写入工具。',
    requiredTools: [
      'commercial.list_overdue_invoices',
      'commercial.explain_metric',
      'commercial.suggest_collection_actions',
    ],
    requiredMarkers: ['逾期', '催收', '确认', '核销'],
  },
  {
    id: 'zh_kpi_gap_dragging_org',
    prompt:
      '本期 KPI 差目标多少？哪个组织拖后腿？请说明完成率和缺口公式，并给后台链接。',
    requiredTools: ['insights.get_kpi_gap', 'insights.explain_kpi_metric'],
    requiredMarkers: ['KPI', '缺口', '完成率', '公式'],
  },
  {
    id: 'zh_kpi_target_write_suggestion',
    prompt:
      '如果我要调整 KPI 目标，AI 应该怎么提出确认写入？请先解释口径，再给出需要确认的目标维护动作。',
    requiredTools: ['insights.explain_kpi_metric', 'insights.suggest_kpi_actions'],
    requiredMarkers: ['KPI', '目标', '确认', '口径'],
  },
  {
    id: 'zh_delay_mitigation_write_suggestion',
    prompt:
      '延期项目怎么处置？请基于延期里程碑和风险给缓解动作，并说明哪些动作需要确认后写入。',
    requiredTools: [
      'projects.get_delay_summary',
      'projects.explain_delay_rule',
      'projects.suggest_delay_mitigation',
    ],
    requiredMarkers: ['延期', '里程碑', '风险', '确认'],
  },
  {
    id: 'zh_bulk_governance_disposition',
    prompt:
      '把当前 critical 检出按负责人角色批量分派，并给建议完成日；注意不要直接说已完成，要说明需要确认。',
    requiredTools: [
      'governance.list_findings',
      'governance.explain_rule',
      'governance.suggest_disposition',
      'governance.update_findings_disposition',
    ],
    requiredMarkers: ['critical', '批量', '负责人', '确认'],
  },
  {
    id: 'zh_invoice_allocation_detail',
    prompt:
      '这笔逾期发票有哪些核销明细？回款率的分子分母分别是什么？请给公式来源和发票链接。',
    requiredTools: [
      'commercial.list_overdue_invoices',
      'commercial.list_payment_allocations',
      'commercial.explain_metric',
    ],
    requiredMarkers: ['核销', '回款率', '分子', '分母'],
  },
  {
    id: 'zh_contract_invoice_payment_write_loop',
    prompt:
      '如果客户今天付款，需要怎么登记合同回款并分配到发票？请列出合同、开票、回款、核销的确认写入步骤。',
    requiredTools: [
      'commercial.list_contracts',
      'commercial.list_invoices',
      'commercial.list_payments',
      'commercial.list_payment_allocations',
    ],
    requiredMarkers: ['合同', '开票', '回款', '核销', '确认'],
  },
  {
    id: 'zh_daily_digest',
    prompt:
      '今天经营摘要有哪些需要我先处理？请按 critical 检出、逾期回款、延期项目、KPI 缺口排序。',
    requiredTools: [
      'governance.list_findings',
      'commercial.list_overdue_invoices',
      'projects.get_delay_summary',
      'insights.get_kpi_gap',
    ],
    requiredMarkers: ['今日', 'critical', '逾期', '延期', 'KPI'],
  },
  {
    id: 'zh_inbox_proposals',
    prompt:
      '列出待处理收件箱提案，说明条数和状态来源，给出提案证据 ID 和后台链接。如果要接受 pending 动作，必须走确认卡，不要说已经写入。',
    requiredTools: ['inbox_ops_list_proposals'],
    requiredMarkers: ['提案', '确认', '证据'],
  },
  {
    id: 'zh_sales_orders',
    prompt:
      '列出当前订单，给出条数或金额、来源、证据 ID 和后台链接。说明改状态需要确认写入。',
    requiredTools: ['sales.list_orders'],
    requiredMarkers: ['订单', '确认', '证据'],
  },
  {
    id: 'zh_wms_balances',
    prompt:
      '当前库存余额怎样？给出数量、来源、证据 ID 和后台链接。不要做收货、调整或移库。',
    requiredTools: ['wms.list_balances'],
    requiredMarkers: ['库存', '证据'],
  },
  {
    id: 'zh_workflow_tasks',
    prompt:
      '有哪些待办工作流任务？给出任务状态来源、证据 ID 和后台链接。认领或完成必须走确认卡。',
    requiredTools: ['workflows.list_tasks'],
    requiredMarkers: ['任务', '确认', '证据'],
  },
  {
    id: 'zh_integrations_health',
    prompt:
      '集成连接器健康状况如何？给出启用状态、来源、证据 ID 和后台链接，不要输出凭据。',
    requiredTools: ['integrations.list_integrations'],
    requiredMarkers: ['集成', '凭据', '证据'],
  },
  {
    id: 'zh_customers_companies',
    prompt:
      '列出当前客户公司，给出条数、来源、证据 ID 和后台链接。',
    requiredTools: ['customers.list_companies'],
    requiredMarkers: ['客户', '证据'],
  },
  {
    id: 'zh_catalog_products',
    prompt:
      '查一下现有商品，给出条数或 SKU、来源、证据 ID 和后台链接。',
    requiredTools: ['catalog.search_products'],
    requiredMarkers: ['商品', '证据'],
  },
  {
    id: 'zh_cross_hop_customer_to_governance',
    prompt:
      '这个客户的商机和订单怎样？项目延期了吗？合同回款和 KPI、治理检出如何？请一次串联给出数字、公式来源、证据 ID 和后台链接。',
    requiredTools: [
      'customers.list_companies',
      'customers.list_deals',
      'sales.list_orders',
      'projects.get_delay_summary',
      'commercial.get_project_settlement_summary',
      'insights.get_kpi_gap',
      'governance.list_findings',
    ],
    requiredMarkers: ['客户', '订单', '延期', '回款', 'KPI', '治理', '证据'],
  },
  {
    id: 'zh_messages_inbox',
    prompt:
      '列出站内消息，给出条数、来源、证据 ID 和后台链接。不要声称已发送或已归档。',
    requiredTools: ['messages.list_messages'],
    requiredMarkers: ['消息', '证据'],
  },
  {
    id: 'zh_staff_roster',
    prompt:
      '列出当前团队成员，给出条数、来源、证据 ID 和后台链接。请假列表只读，不要审批。',
    requiredTools: ['staff.list_team_members'],
    requiredMarkers: ['员工', '证据'],
  },
  {
    id: 'zh_risk_confirm_write',
    prompt:
      '当前项目有哪些风险？如果要改成 mitigating，必须走确认卡，不要说已经写入。',
    requiredTools: ['projects.list_risks', 'projects.manage_risk'],
    requiredMarkers: ['风险', '确认'],
  },
]

export const OPERATING_LOOP_TOOL_NAME_PATTERN = /^(?:[a-z_]+\.[a-z0-9_]+|inbox_ops_[a-z0-9_]+)$/

export function normalizeToolName(name) {
  return String(name ?? '').replace(/__/g, '.')
}

export function extractToolCallSequence(sse) {
  const toolNames = []
  for (const rawLine of String(sse ?? '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const parsed = JSON.parse(payload)
      if (parsed?.type === 'tool-input-start' && typeof parsed.toolName === 'string') {
        toolNames.push(normalizeToolName(parsed.toolName))
      } else if (parsed?.type === 'function_call' && typeof parsed.name === 'string') {
        toolNames.push(normalizeToolName(parsed.name))
      }
    } catch {
      // Ignore provider text chunks and non-JSON keep-alives.
    }
  }
  return toolNames
}

export function extractAssistantTextFromSse(sse) {
  const chunks = []
  for (const rawLine of String(sse ?? '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const parsed = JSON.parse(payload)
      if (parsed?.type === 'text-delta' && typeof parsed.delta === 'string') {
        chunks.push(parsed.delta)
      } else if (parsed?.type === 'text' && typeof parsed.content === 'string') {
        chunks.push(parsed.content)
      } else if (parsed?.type === 'text-start' && typeof parsed.text === 'string') {
        chunks.push(parsed.text)
      } else if (!parsed?.type && typeof parsed.content === 'string') {
        chunks.push(parsed.content)
      }
    } catch {
      // Plain text chunks are rare in the app stream, but provider proxies may emit them.
      if (!payload.startsWith('{')) chunks.push(payload)
    }
  }
  return chunks.join('')
}

function containsAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text))
}

export function evaluateOperatingLoopAnswer({ text, toolCalls, promptCase }) {
  const normalizedText = String(text ?? '')
  const calls = Array.isArray(toolCalls) ? toolCalls.map(normalizeToolName) : []
  const requiredTools = promptCase?.requiredTools ?? OPERATING_LOOP_REQUIRED_TOOLS
  const missingTools = requiredTools.filter((tool) => !calls.includes(tool))
  const missingMarkers = (promptCase?.requiredMarkers ?? []).filter(
    (marker) => !normalizedText.toLowerCase().includes(String(marker).toLowerCase()),
  )
  const checks = {
    hasNumber: containsAny(normalizedText, [/\d+(?:\.\d+)?%?/, /[零一二三四五六七八九十百千万亿]+/]),
    hasFormulaSource: containsAny(normalizedText, [
      /公式/,
      /formula/i,
      /source/i,
      /来源/,
      /commercial\.metrics/,
      /projects\.lib\.milestoneDelay/,
    ]),
    hasBackendHref: /\/backend\//.test(normalizedText),
      hasEvidenceMarker: containsAny(normalizedText, [
        /evidence/i,
        /证据/,
        /finding\.id/i,
        /检出 ID/,
        /治理检出/,
        /提案 ID/,
        /proposal\.id/i,
      ]),
  }
  const failures = []
  if (missingTools.length > 0) failures.push(`missing tools: ${missingTools.join(', ')}`)
  if (missingMarkers.length > 0) failures.push(`missing prompt markers: ${missingMarkers.join(', ')}`)
  for (const [key, passed] of Object.entries(checks)) {
    if (!passed) failures.push(`missing ${key}`)
  }
  return {
    passed: failures.length === 0,
    failures,
    missingTools,
    missingMarkers,
    checks,
    toolCalls: calls,
  }
}

export function assertOperatingLoopAnswerQuality(input) {
  const result = evaluateOperatingLoopAnswer(input)
  if (!result.passed) {
    throw new Error(`[operating-loop-acceptance] ${result.failures.join('; ')}`)
  }
  return result
}
