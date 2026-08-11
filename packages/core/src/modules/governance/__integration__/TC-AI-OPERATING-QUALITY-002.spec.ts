import { test, expect, type Page } from '@playwright/test'
import { login } from '@helios/core/helpers/integration/auth'

const playgroundPath = '/backend/config/ai-assistant/playground'

// Operating-loop closed loop: the assistant must traverse the four M-modules
// in dependency order before answering. The contract we guard is the
// *module* traversal order — which specific query tool the agent picks per
// module is a model-pick, not a contract. LLM temperature makes a fixed
// tool-name list flaky.
const EXPECTED_LOOP_MODULES = ['projects', 'commercial', 'insights', 'governance'] as const

// The AI SDK v5 wire format encodes `module.tool_name` as `module__tool_name`
// (double underscore) to avoid clashing with JSON dot-paths inside tool args.
// We normalize back to the dot form so the assertions can use the canonical
// names from `OPERATING_LOOP_ALLOWED_TOOLS`.
function normalizeToolName(value: string): string {
  return value.replace(/__/g, '.')
}

async function readVisibleToolCallSequence(page: Page): Promise<string[]> {
  const rawToolNames = await page.locator('[data-ai-chat-tool-call]').evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute('data-ai-chat-tool-call') ?? '')
      .filter((value) => value.length > 0),
  )
  return rawToolNames.map(normalizeToolName)
}

function loopOrderSatisfied(captured: string[], expected: readonly string[]): boolean {
  const positions = expected.map((module) =>
    captured.findIndex((tool) => tool === module || tool.startsWith(`${module}.`)),
  )
  return positions.every((position) => position >= 0)
    && positions.every((position, index) => index === 0 || position > positions[index - 1])
}

// First-appearance-per-module check: every module must contribute at least
// one tool call, and the first call from each module must appear in the
// declared order (project -> commercial -> insights -> governance), even if
// the agent interleaves helper calls (e.g. meta.*) or re-calls a module.
function assertLoopOrder(captured: string[], expected: readonly string[]): void {
  const positions = expected.map((module) =>
    captured.findIndex((tool) => tool === module || tool.startsWith(`${module}.`)),
  )
  for (let i = 0; i < positions.length; i += 1) {
    expect(
      positions[i],
      `expected at least one tool call from module "${expected[i]}"; captured: [${captured.join(', ')}]`,
    ).toBeGreaterThanOrEqual(0)
  }
  for (let i = 1; i < positions.length; i += 1) {
    expect(
      positions[i],
      `expected ${expected[i]} to be entered after ${expected[i - 1]} in the operating loop`,
    ).toBeGreaterThan(positions[i - 1])
  }
}

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
    test.setTimeout(300_000)
    await login(page, 'superadmin')

    // Drives the REAL agent — no chat-route mocking. The chat route streams
    // AI SDK v5 JSON events; AiChat renders tool-call rows as they arrive, and
    // this spec asserts those visible UI rows instead of waiting for the SSE
    // HTTP response to close.
    const prompt =
      'Give me a full operating-loop picture: which projects are delayed, how is contract collection, where are KPI gaps, and any governance findings. Use one query tool per module, then explain each one.'

    await page.goto(playgroundPath, { waitUntil: 'domcontentloaded' })

    const picker = page.locator('[data-ai-playground-agent-picker]')
    await expect(picker).toBeVisible({ timeout: 60_000 })
    await picker.selectOption('insights.operating_loop_assistant')

    const composer = page.locator('#ai-chat-composer')
    await expect(composer).toBeVisible({ timeout: 60_000 })

    // Race: start waiting for the chat response BEFORE sending the prompt so
    // we don't miss the response event if the LLM is fast.
    const chatResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/ai_assistant/ai/chat'),
      { timeout: 120_000 },
    )

    await composer.fill(prompt)
    await page.getByRole('button', { name: /send message/i }).click()

    await expect(composer).toHaveValue('', { timeout: 120_000 })

    const chatResponse = await chatResponsePromise
    const chatUrl = chatResponse.url()
    const chatBody = JSON.parse(chatResponse.request().postData() || '{}') as Record<string, unknown>

    expect(chatUrl).toContain('agent=insights.operating_loop_assistant')
    const messages = chatBody.messages as Array<{ role?: string; content?: string }>
    expect(messages.at(-1)).toMatchObject({ role: 'user', content: prompt })

    await expect
      .poll(async () => loopOrderSatisfied(await readVisibleToolCallSequence(page), EXPECTED_LOOP_MODULES), {
        timeout: 240_000,
        intervals: [1_000, 2_000, 5_000],
      })
      .toBe(true)
    const toolSequence = await readVisibleToolCallSequence(page)
    expect(toolSequence.length).toBeGreaterThan(0)
    assertLoopOrder(toolSequence, EXPECTED_LOOP_MODULES)
  })
})
