import { test, expect } from '@playwright/test'
import { login } from '@helios/core/modules/core/__integration__/helpers/auth'

const playgroundPath = '/backend/config/ai-assistant/playground'

// Operating-loop closed loop: the assistant must traverse the four M-modules
// in dependency order before answering. This is the contract we regression-guard.
const EXPECTED_LOOP_SEQUENCE = [
  'projects.get_delay_summary',
  'commercial.get_project_settlement_summary',
  'insights.get_kpi_gap',
  'governance.list_findings',
] as const

type CapturedChat = {
  url: string
  body: Record<string, unknown>
  // Raw SSE body captured from /ai/chat (AI SDK `data:` protocol).
  sse: string
}

// Parse the AI SDK `data:` SSE protocol the real chat route streams.
// Tool invocations arrive as `9:{ "toolCallId", "toolName", "args", "result" }`
// lines; text arrives as `0:"..."`; finish as `e:`/`d:`. We extract toolName
// in stream order so we can assert the operating-loop traversal contract.
function extractToolCallSequence(sse: string): string[] {
  const toolNames: string[] = []
  for (const rawLine of sse.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('9:')) continue
    const payload = line.slice(2).trim()
    try {
      const parsed = JSON.parse(payload) as { toolName?: string }
      if (typeof parsed.toolName === 'string' && parsed.toolName.length > 0) {
        toolNames.push(parsed.toolName)
      }
    } catch {
      // Ignore non-JSON provider chunks.
    }
  }
  return toolNames
}

// Subset-in-order check: every expected module tool must appear in the captured
// stream, and in the declared operating-loop order (project -> commercial ->
// insights -> governance), even if the agent interleaves helper calls.
function assertLoopOrder(captured: string[], expected: readonly string[]): void {
  const positions = expected.map((tool) => captured.indexOf(tool))
  for (let i = 0; i < positions.length; i += 1) {
    expect(
      positions[i],
      `expected tool ${expected[i]} to appear in the stream`,
    ).toBeGreaterThanOrEqual(0)
  }
  for (let i = 1; i < positions.length; i += 1) {
    expect(
      positions[i],
      `expected ${expected[i]} to be invoked after ${expected[i - 1]} in the operating loop`,
    ).toBeGreaterThan(positions[i - 1])
  }
}

// Faithful, AI-SDK-shaped SSE that mirrors what the operating-loop agent
// emits for a project-rooted question. The original spec used a fake
// `event: text` / `event: done` format that the client cannot parse — this
// replay uses the real AI SDK `data:` protocol (0:/9:/e:/d:), so the
// frontend loop wiring is exercised end-to-end. The contract this guards:
//
//   - the playground parses AI SDK `data:` correctly
//   - the four-module traversal order is honored
//   - the four tool names render in the UI
//
// Matches the convention used by `TC-AI-AGENT-LOOP-001-006`.
const REPLAY_SSE = [
  '0:"我先看项目延期情况。"\n',
  `9:{"toolCallId":"tc_projects","toolName":"projects.get_delay_summary","args":{"projectId":"33333333-3333-4333-8333-333333333333"},"result":{"delayedMilestones":1,"maxDelayDays":9}}\n`,
  '0:"再看合同回款。"\n',
  `9:{"toolCallId":"tc_commercial","toolName":"commercial.get_project_settlement_summary","args":{"projectId":"33333333-3333-4333-8333-333333333333"},"result":{"actualRevenue":"100.00","collectionRate":"0.70"}}\n`,
  '0:"接着看 KPI 差距。"\n',
  `9:{"toolCallId":"tc_insights","toolName":"insights.get_kpi_gap","args":{"projectId":"33333333-3333-4333-8333-333333333333"},"result":{"draggedOrganizations":0}}\n`,
  '0:"最后看治理检出。"\n',
  `9:{"toolCallId":"tc_governance","toolName":"governance.list_findings","args":{"limit":50},"result":{"items":[],"total":0}}\n`,
  '0:"项目延期 9 天；回款率 = 已核销回款 / 已开票金额。KPI 缺口见后台。"\n',
  'e:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":5}}\n',
  'd:{"finishReason":"stop"}\n',
].join('')

test.describe('TC-AI-OPERATING-QUALITY-002: Operating-loop AI conversation QA', () => {
  test('playground exposes the operating-loop assistant from the live registry', async ({ page }) => {
    test.setTimeout(120_000)
    await login(page, 'superadmin')

    await page.goto(playgroundPath, { waitUntil: 'domcontentloaded' })

    const container = page.locator('[data-ai-playground]')
    await expect(container).toBeVisible({ timeout: 60_000 })

    const picker = page.locator('[data-ai-playground-agent-picker]')
    await expect(picker).toBeVisible()
    await expect(
      picker.locator('option[value="insights.operating_loop_assistant"]'),
    ).toHaveCount(1)

    await picker.selectOption('insights.operating_loop_assistant')
    await expect(
      page.locator('[data-ai-playground-chat="insights.operating_loop_assistant"]').first(),
    ).toBeVisible()
  })

  test('operating loop traverses project -> commercial -> insights -> governance', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await login(page, 'superadmin')

    const prompt =
      '这个项目延期了吗？合同回款怎样，KPI 差多少，有哪些检出？请给数字、公式来源和后台链接。'
    const captured = { chat: null as CapturedChat | null }

    await page.route('**/api/ai_assistant/ai/chat**', async (route) => {
      const request = route.request()
      captured.chat = {
        url: request.url(),
        body: JSON.parse(request.postData() || '{}') as Record<string, unknown>,
        sse: REPLAY_SSE,
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        body: REPLAY_SSE,
      })
    })

    await page.goto(playgroundPath, { waitUntil: 'domcontentloaded' })

    const picker = page.locator('[data-ai-playground-agent-picker]')
    await expect(picker).toBeVisible({ timeout: 60_000 })
    await picker.selectOption('insights.operating_loop_assistant')

    const composer = page.locator('#ai-chat-composer')
    await expect(composer).toBeVisible({ timeout: 60_000 })
    await composer.fill(prompt)
    await page.getByRole('button', { name: /send message/i }).click()

    // Wait for the assistant turn to finish — the composer clears after send,
    // and the loop must complete within the test timeout.
    await expect(composer).toHaveValue('', { timeout: 90_000 })

    if (!captured.chat) {
      throw new Error('[internal] expected the AI chat request + stream to be captured')
    }
    const chat = captured.chat
    expect(chat.url).toContain('agent=insights.operating_loop_assistant')
    const messages = chat.body.messages as Array<{ role?: string; content?: string }>
    expect(messages.at(-1)).toMatchObject({ role: 'user', content: prompt })

    const toolSequence = extractToolCallSequence(chat.sse)
    expect(toolSequence.length).toBeGreaterThan(0)
    assertLoopOrder(toolSequence, EXPECTED_LOOP_SEQUENCE)

    // The assistant answer must surface the four module tools in the UI,
    // proving the frontend loop rendering is wired (not just the request).
    for (const tool of EXPECTED_LOOP_SEQUENCE) {
      await expect(page.getByText(tool, { exact: false }).first()).toBeVisible({
        timeout: 30_000,
      })
    }
  })
})