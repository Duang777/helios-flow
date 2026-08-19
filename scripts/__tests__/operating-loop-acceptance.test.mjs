import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OPERATING_LOOP_ACCEPTANCE_PROMPTS,
  OPERATING_LOOP_TOOL_NAME_PATTERN,
  assertOperatingLoopAnswerQuality,
  evaluateOperatingLoopAnswer,
  extractAssistantTextFromSse,
  extractToolCallSequence,
} from '../lib/operating-loop-acceptance.mjs'

test('extractToolCallSequence normalizes AI SDK tool names', () => {
  const sse = [
    'data: {"type":"tool-input-start","toolName":"projects__get_delay_summary"}',
    'data: {"type":"tool-input-start","toolName":"commercial__get_project_settlement_summary"}',
    'data: not-json',
    'data: {"type":"tool-input-start","toolName":"insights__get_kpi_gap"}',
  ].join('\n')

  assert.deepEqual(extractToolCallSequence(sse), [
    'projects.get_delay_summary',
    'commercial.get_project_settlement_summary',
    'insights.get_kpi_gap',
  ])
})

test('extractAssistantTextFromSse reads text deltas and plain provider chunks', () => {
  const sse = [
    'data: {"type":"text-delta","delta":"延期 1 个，"}',
    'data: plain fallback chunk',
    'data: {"type":"text","content":" /backend/projects/abc"}',
  ].join('\n')

  assert.equal(extractAssistantTextFromSse(sse), '延期 1 个，plain fallback chunk /backend/projects/abc')
})

test('evaluateOperatingLoopAnswer reports missing tools and answer markers', () => {
  const result = evaluateOperatingLoopAnswer({
    text: '这里只说了概览，没有数字。',
    toolCalls: ['projects.get_delay_summary'],
    promptCase: OPERATING_LOOP_ACCEPTANCE_PROMPTS[0],
  })

  assert.equal(result.passed, false)
  assert.ok(result.missingTools.includes('commercial.get_project_settlement_summary'))
  assert.ok(result.failures.some((failure) => failure.includes('missing hasBackendHref')))
})

test('all operating-loop acceptance prompts declare stable tool and marker expectations', () => {
  assert.ok(OPERATING_LOOP_ACCEPTANCE_PROMPTS.length >= 15)
  const ids = new Set()
  for (const promptCase of OPERATING_LOOP_ACCEPTANCE_PROMPTS) {
    assert.equal(typeof promptCase.id, 'string')
    assert.ok(!ids.has(promptCase.id), `duplicate prompt id: ${promptCase.id}`)
    ids.add(promptCase.id)
    assert.equal(typeof promptCase.prompt, 'string')
    assert.ok(promptCase.prompt.length > 10, `${promptCase.id} prompt is too short`)
    assert.ok(Array.isArray(promptCase.requiredTools), `${promptCase.id} missing requiredTools`)
    assert.ok(promptCase.requiredTools.length > 0, `${promptCase.id} requiredTools is empty`)
    assert.ok(Array.isArray(promptCase.requiredMarkers), `${promptCase.id} missing requiredMarkers`)
    assert.ok(promptCase.requiredMarkers.length > 0, `${promptCase.id} requiredMarkers is empty`)
    for (const tool of promptCase.requiredTools) {
      assert.match(
        tool,
        OPERATING_LOOP_TOOL_NAME_PATTERN,
        `${promptCase.id} has invalid tool name ${tool}`,
      )
    }
    for (const marker of promptCase.requiredMarkers) {
      if (Array.isArray(marker)) {
        assert.ok(marker.length > 0, `${promptCase.id} empty marker alternative group`)
        for (const item of marker) {
          assert.equal(typeof item, 'string', `${promptCase.id} marker alternative must be string`)
        }
      } else {
        assert.equal(typeof marker, 'string', `${promptCase.id} marker must be string or string[]`)
      }
    }
    if (promptCase.skipChecks !== undefined) {
      assert.ok(Array.isArray(promptCase.skipChecks), `${promptCase.id} skipChecks must be array`)
    }
  }
  const promptIds = OPERATING_LOOP_ACCEPTANCE_PROMPTS.map((promptCase) => promptCase.id)
  for (const id of [
    'zh_inbox_proposals',
    'zh_sales_orders',
    'zh_wms_balances',
    'zh_workflow_tasks',
    'zh_integrations_health',
    'zh_customers_companies',
    'zh_catalog_products',
    'zh_cross_hop_customer_to_governance',
    'zh_messages_inbox',
    'zh_staff_roster',
    'zh_risk_confirm_write',
  ]) {
    assert.ok(promptIds.includes(id), `missing platform hop prompt ${id}`)
  }
})

test('risk confirm prompt can skip formula-source check', () => {
  const promptCase = OPERATING_LOOP_ACCEPTANCE_PROMPTS.find((item) => item.id === 'zh_risk_confirm_write')
  assert.ok(promptCase)
  const result = assertOperatingLoopAnswerQuality({
    text:
      '风险 0 条。已发起确认卡创建示例风险，未写入。证据: projectId=abc。',
    toolCalls: ['projects.list_risks', 'projects.manage_risk'],
    promptCase,
  })
  assert.equal(result.passed, true)
})

test('cross-hop markers accept 未延期 alternative', () => {
  const promptCase = OPERATING_LOOP_ACCEPTANCE_PROMPTS.find(
    (item) => item.id === 'zh_cross_hop_customer_to_governance',
  )
  assert.ok(promptCase)
  const result = assertOperatingLoopAnswerQuality({
    text:
      '商机 2 个；订单 4 单；项目未延期；回款率 60%，公式来源 commercial.metrics；KPI 缺口 200；治理检出 finding.id=abc，证据 invoice-1，链接 /backend/governance/findings/abc。',
    toolCalls: promptCase.requiredTools,
    promptCase,
  })
  assert.equal(result.passed, true)
})

test('inbox acceptance prompt allows underscore tool names and evidence IDs', () => {
  const promptCase = OPERATING_LOOP_ACCEPTANCE_PROMPTS.find((item) => item.id === 'zh_inbox_proposals')
  assert.ok(promptCase)
  const result = assertOperatingLoopAnswerQuality({
    text:
      '待处理提案 1 条，来源 inbox_ops。证据: 提案 ID proposal-1。接受需确认卡，未写入。链接 /backend/inbox-ops/proposals/proposal-1。',
    toolCalls: ['inbox_ops_list_proposals'],
    promptCase,
  })
  assert.equal(result.passed, true)
})

test('assertOperatingLoopAnswerQuality accepts a complete Chinese closed-loop answer', () => {
  const result = assertOperatingLoopAnswerQuality({
    text:
      '延期 1 个；回款率 60%，公式来源 commercial.metrics；KPI 缺口 200；治理检出 finding.id=abc，证据 invoice-1，链接 /backend/governance/findings/abc。',
    toolCalls: [
      'projects.get_delay_summary',
      'commercial.get_project_settlement_summary',
      'insights.get_kpi_gap',
      'governance.list_findings',
    ],
    promptCase: OPERATING_LOOP_ACCEPTANCE_PROMPTS[0],
  })

  assert.equal(result.passed, true)
})
