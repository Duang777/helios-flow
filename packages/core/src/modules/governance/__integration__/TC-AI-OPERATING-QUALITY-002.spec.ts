import { test, expect } from '@playwright/test'
import { login } from '@helios/core/modules/core/__integration__/helpers/auth'

const playgroundPath = '/backend/config/ai-assistant/playground'

type CapturedChatRequest = {
  url: string
  body: Record<string, unknown>
}

function requireCapturedChatRequest(value: CapturedChatRequest | null): CapturedChatRequest {
  if (!value) {
    throw new Error('[internal] expected the AI chat request to be captured')
  }
  return value
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
      page.locator('[data-ai-chat-agent="insights.operating_loop_assistant"]').first(),
    ).toBeVisible()
  })

  test('submits a fixed closed-loop prompt to the selected operating-loop assistant', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await login(page, 'superadmin')

    const prompt =
      '这个项目延期了吗？合同回款怎样，KPI 差多少，有哪些检出？请给数字、公式来源和后台链接。'
    let capturedChatRequest: CapturedChatRequest | null = null

    await page.route('**/api/ai_assistant/ai/agents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          agents: [
            {
              id: 'insights.operating_loop_assistant',
              moduleId: 'insights',
              label: 'Operating Loop Assistant',
              description: 'Cross-module operating advisor.',
              executionMode: 'chat',
              mutationPolicy: 'confirm-required',
              readOnly: false,
              allowedTools: [
                'projects.get_delay_summary',
                'commercial.get_project_settlement_summary',
                'insights.get_kpi_gap',
                'governance.list_findings',
              ],
              requiredFeatures: [],
              acceptedMediaTypes: [],
              hasOutputSchema: false,
            },
          ],
          total: 1,
        }),
      })
    })

    await page.route('**/api/ai_assistant/ai/chat**', async (route) => {
      capturedChatRequest = {
        url: route.request().url(),
        body: JSON.parse(route.request().postData() || '{}') as Record<string, unknown>,
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'event: text',
          'data: {"content":"项目延期 9 天；回款率 = 已核销回款 / 已开票金额。"}',
          '',
          'event: done',
          'data: {}',
          '',
        ].join('\n'),
      })
    })

    await page.goto(playgroundPath, { waitUntil: 'domcontentloaded' })

    const composer = page.locator('#ai-chat-composer')
    await expect(composer).toBeVisible({ timeout: 60_000 })
    await composer.fill(prompt)
    await page.getByRole('button', { name: /send message/i }).click()

    await expect(async () => {
      expect(capturedChatRequest).not.toBeNull()
    }).toPass({ timeout: 10_000 })

    const chatRequest = requireCapturedChatRequest(capturedChatRequest)
    expect(chatRequest.url).toContain('agent=insights.operating_loop_assistant')
    const messages = chatRequest.body.messages as Array<{ role?: string; content?: string }>
    expect(messages.at(-1)).toMatchObject({ role: 'user', content: prompt })
    await expect(composer).toHaveValue('')
  })
})
