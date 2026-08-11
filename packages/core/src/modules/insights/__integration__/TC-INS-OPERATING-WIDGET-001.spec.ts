import { test, expect } from '@playwright/test'
import { login } from '@helios/core/helpers/integration/auth'
import { getAuthToken, apiRequest } from '@helios/core/helpers/integration/api'
import { getTokenContext, expectId } from '@helios/core/helpers/integration/generalFixtures'

test.describe('TC-INS-OPERATING-WIDGET-001: Operating Loop page-context widget', () => {
  test('project detail opens the assistant with the current project context', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)
    const token = await getAuthToken(request, 'admin')
    const { organizationId, tenantId } = getTokenContext(token)
    const suffix = Date.now().toString(36)
    const projectName = `QA Operating Widget Project ${suffix}`
    let projectId: string | null = null

    try {
      const createProject = await apiRequest(request, 'POST', '/api/projects/projects', {
        token,
        data: {
          organizationId,
          tenantId,
          name: projectName,
          code: `QA-OW-${suffix}`,
          status: 'active',
          isActive: true,
        },
      })
      expect(createProject.ok(), `create project failed: ${createProject.status()}`).toBeTruthy()
      const createdProject = (await createProject.json()) as { id?: string }
      projectId = expectId(createdProject.id, 'project id missing')

      await login(page, 'admin')
      await page.goto(`/backend/projects/${projectId}`, { waitUntil: 'domcontentloaded' })

      await expect(page.getByText(projectName).first()).toBeVisible({ timeout: 60_000 })
      const trigger = page.locator(
        `[data-operating-loop-ai-trigger][data-operating-loop-record-id="${projectId}"]`,
      )
      await expect(trigger).toBeVisible({ timeout: 60_000 })

      await trigger.click()

      const sheet = page.locator('[data-operating-loop-ai-sheet]')
      await expect(sheet).toBeVisible({ timeout: 60_000 })
      await expect(sheet.getByText(/Operating Loop Assistant|经营参谋/).first()).toBeVisible()
      await expect(sheet.locator('[data-ai-chat-context-items]')).toBeVisible()
      await expect(
        sheet.locator('[data-ai-chat-context-item]').filter({ hasText: projectId }).first(),
      ).toBeVisible()
      await expect(sheet.locator('#ai-chat-composer')).toBeVisible()
    } finally {
      if (projectId) {
        await apiRequest(request, 'DELETE', `/api/projects/projects?id=${projectId}`, { token })
      }
    }
  })
})
