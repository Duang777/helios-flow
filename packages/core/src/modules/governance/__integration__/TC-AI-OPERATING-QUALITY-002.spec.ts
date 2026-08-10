import { test, expect } from '@playwright/test'
import { login } from '@helios/core/modules/core/__integration__/helpers/auth'

const playgroundPath = '/backend/config/ai-assistant/playground'

// Operating-loop closed loop: the assistant must traverse the four M-modules
// in dependency order before answering. The contract we guard is the
// *module* traversal order — which specific query tool the agent picks per
// module is a model-pick, not a contract. LLM temperature makes a fixed
// tool-name list flaky.
const EXPECTED_LOOP_MODULES = ['projects', 'commercial', 'insights', 'governance'] as const

// Parse the AI SDK v5 UI-message stream format the real chat route emits.
// Each event is a JSON object on its own `data:` line; tool invocations are
// announced by `tool-input-start` events that carry the toolName.
//
// The AI SDK v5 wire format encodes `module.tool_name` as `module__tool_name`
// (double underscore) to avoid clashing with JSON dot-paths inside tool args.
// We normalize back to the dot form so the assertions can use the canonical
// names from `OPERATING_LOOP_ALLOWED_TOOLS`.
function extractToolCallSequence(sse: string): string[] {
  const toolNames: string[] = []
  for (const rawLine of sse.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (!payload) continue
    try {
      const parsed = JSON.parse(payload) as {
        type?: string
        toolName?: string
      }
      if (parsed.type === 'tool-input-start' && typeof parsed.toolName === 'string') {
        toolNames.push(parsed.toolName.replace(/__/g, '.'))
      }
    } catch {
      // Ignore non-JSON provider chunks.
    }
  }
  return toolNames
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
    test.setTimeout(180_000)
    await login(page, 'superadmin')

    // Drives the REAL agent — no chat-route mocking. The chat route streams
    // AI SDK v5 JSON events; we capture them via Playwright passthrough and
    // assert the four-module traversal order. Requires OPENAI_API_KEY (or a
    // HELIOS_AI_* override) to be configured in apps/helios/.env.
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

    // Wait for the assistant turn to finish — the composer clears after send.
    await expect(composer).toHaveValue('', { timeout: 120_000 })

    const chatResponse = await chatResponsePromise
    const chatUrl = chatResponse.url()
    const chatBody = JSON.parse(chatResponse.request().postData() || '{}') as Record<string, unknown>
    const chatSse = await chatResponse.text()

    expect(chatUrl).toContain('agent=insights.operating_loop_assistant')
    const messages = chatBody.messages as Array<{ role?: string; content?: string }>
    expect(messages.at(-1)).toMatchObject({ role: 'user', content: prompt })

    const toolSequence = extractToolCallSequence(chatSse)
    expect(toolSequence.length).toBeGreaterThan(0)
    assertLoopOrder(toolSequence, EXPECTED_LOOP_MODULES)
  })
})