import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OPERATING_LOOP_ACCEPTANCE_PROMPTS,
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
  assert.ok(OPERATING_LOOP_ACCEPTANCE_PROMPTS.length >= 10)
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
      assert.match(tool, /^[a-z_]+\.[a-z0-9_]+$/, `${promptCase.id} has invalid tool name ${tool}`)
    }
  }
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
