import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { login } from '@helios/core/helpers/integration/auth'
import { getAuthToken, apiRequest } from '@helios/core/helpers/integration/api'
import { getTokenContext, expectId, readJsonSafe } from '@helios/core/helpers/integration/generalFixtures'
import { createSalesOrderFixture, deleteSalesEntityIfExists } from '@helios/core/helpers/integration/salesFixtures'
import { createProductFixture, deleteCatalogProductIfExists } from '@helios/core/helpers/integration/catalogFixtures'
import {
  buildClaimableUserTaskDefinitionPayload,
  cancelWorkflowInstanceIfExists,
  createWorkflowDefinitionFixture,
  deleteWorkflowDefinitionIfExists,
  findInstanceUserTask,
  startWorkflowInstanceFixture,
} from '@helios/core/helpers/integration/workflowsFixtures'
import {
  deleteInboxEmail,
  submitTextExtraction,
  waitForEmailProcessed,
} from '@helios/core/helpers/integration/inboxFixtures'

const LIST_TRIGGER_PAGES: Array<{ path: string; tableIds: string[] }> = [
  { path: '/backend/sales/orders', tableIds: ['sales.orders'] },
  { path: '/backend/sales/quotes', tableIds: ['sales.quotes'] },
  { path: '/backend/catalog/products', tableIds: ['catalog.products.list', 'catalog.products'] },
  { path: '/backend/inbox-ops', tableIds: ['inbox_ops.proposals.list'] },
  { path: '/backend/instances', tableIds: ['workflows.instances.list'] },
  { path: '/backend/tasks', tableIds: ['workflows.tasks.list'] },
  { path: '/backend/wms/inventory', tableIds: ['wms.inventory.balances', 'wms.inventory.reservations'] },
  { path: '/backend/integrations', tableIds: ['integrations.marketplace'] },
]

function listTriggerLocator(page: Page, tableIds: string[]) {
  return page.locator(
    tableIds.map((tableId) => `[data-operating-loop-ai-trigger][data-operating-loop-table-id="${tableId}"]`).join(', '),
  )
}

async function expectOperatingLoopDetail(page: Page, recordId: string) {
  const trigger = page.locator(
    `[data-operating-loop-ai-trigger][data-operating-loop-record-id="${recordId}"]`,
  )
  await expect(trigger).toBeVisible({ timeout: 60_000 })
  await trigger.click()
  const sheet = page.locator('[data-operating-loop-ai-sheet]')
  await expect(sheet).toBeVisible({ timeout: 60_000 })
  await expect(
    sheet.getByRole('heading', { name: /Operating Loop Assistant|经营闭环助手/ }),
  ).toBeVisible()
  await expect(sheet.locator('[data-ai-chat-context-items]')).toBeVisible()
  await expect(
    sheet.locator('[data-ai-chat-context-item]').filter({ hasText: recordId }).first(),
  ).toBeVisible()
  await expect(sheet.locator('#ai-chat-composer')).toBeVisible()
}

async function pickIntegrationId(request: APIRequestContext, token: string): Promise<string | null> {
  const response = await apiRequest(request, 'GET', '/api/integrations?pageSize=20', { token })
  if (!response.ok()) return null
  const body = await readJsonSafe<{ items?: Array<{ id?: string }> }>(response)
  const id = body?.items?.find((item) => typeof item.id === 'string' && item.id.length > 0)?.id
  return id ?? null
}

test.describe('TC-INS-OPERATING-WIDGET-001: Operating Loop page-context widget', () => {
  test('list pages that already have injection spots mount the operating loop trigger', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await login(page, 'admin')

    for (const entry of LIST_TRIGGER_PAGES) {
      await page.goto(entry.path, { waitUntil: 'domcontentloaded' })
      await expect(
        listTriggerLocator(page, entry.tableIds).first(),
        `missing operating-loop trigger on ${entry.path}`,
      ).toBeVisible({ timeout: 60_000 })
    }
  })

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
      await expectOperatingLoopDetail(page, projectId)
    } finally {
      if (projectId) {
        await apiRequest(request, 'DELETE', `/api/projects/projects?id=${projectId}`, { token })
      }
    }
  })

  test('sales order detail opens the assistant with the current order id', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)
    const token = await getAuthToken(request, 'admin')
    let orderId: string | null = null

    try {
      orderId = await createSalesOrderFixture(request, token)
      await login(page, 'admin')
      await page.goto(`/backend/sales/orders/${orderId}`, { waitUntil: 'domcontentloaded' })
      await expectOperatingLoopDetail(page, orderId)
    } finally {
      await deleteSalesEntityIfExists(request, token, '/api/sales/orders', orderId)
    }
  })

  test('catalog product detail opens the assistant with the current product id', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)
    const token = await getAuthToken(request, 'admin')
    const suffix = Date.now().toString(36)
    let productId: string | null = null

    try {
      productId = await createProductFixture(request, token, {
        title: `QA Operating Widget Product ${suffix}`,
        sku: `QA-OWP-${suffix}`,
      })
      await login(page, 'admin')
      await page.goto(`/backend/catalog/products/${productId}`, { waitUntil: 'domcontentloaded' })
      await expectOperatingLoopDetail(page, productId)
    } finally {
      await deleteCatalogProductIfExists(request, token, productId)
    }
  })

  test('workflow instance and task details open the assistant with record ids', async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000)
    const token = await getAuthToken(request, 'admin')
    const payload = buildClaimableUserTaskDefinitionPayload(Date.now())
    let definitionId: string | null = null
    let instanceId: string | null = null

    try {
      definitionId = await createWorkflowDefinitionFixture(request, token, payload)
      instanceId = await startWorkflowInstanceFixture(request, token, {
        workflowId: payload.workflowId,
        initialContext: {},
      })
      const pendingTask = await findInstanceUserTask(request, token, instanceId, {
        statuses: ['PENDING'],
        timeoutMs: 20_000,
      })
      expect(pendingTask?.id, 'a PENDING user task should be created for the instance').toBeTruthy()
      const taskId = pendingTask!.id!

      await login(page, 'admin')
      await page.goto(`/backend/instances/${instanceId}`, { waitUntil: 'domcontentloaded' })
      await expectOperatingLoopDetail(page, instanceId)

      await page.goto(`/backend/tasks/${taskId}`, { waitUntil: 'domcontentloaded' })
      await expectOperatingLoopDetail(page, taskId)
    } finally {
      await cancelWorkflowInstanceIfExists(request, token, instanceId)
      await deleteWorkflowDefinitionIfExists(request, token, definitionId)
    }
  })

  test('inbox proposal detail opens the assistant with the current proposal id', async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000)
    const token = await getAuthToken(request, 'admin')
    let emailId: string | null = null

    try {
      let extracted: Awaited<ReturnType<typeof submitTextExtraction>>
      try {
        extracted = await submitTextExtraction(request, token, {
          text: 'Hello, I am Jane Smith <jane@operating-widget.test>. Please send a quote for 3 Premium Widget at $50 each.',
          title: `QA Operating Widget Inbox ${Date.now()}`,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        test.skip(true, `inbox extract unavailable: ${message}`)
        return
      }
      test.skip(!extracted.ok || !extracted.emailId, `inbox extract unavailable: ${extracted.error ?? extracted.status}`)
      emailId = extracted.emailId ?? null
      const processed = emailId ? await waitForEmailProcessed(request, token, emailId) : null
      test.skip(!processed?.proposalId, 'inbox extract did not produce a proposal')
      const proposalId = processed!.proposalId!

      await login(page, 'admin')
      await page.goto(`/backend/inbox-ops/proposals/${proposalId}`, { waitUntil: 'domcontentloaded' })
      await expectOperatingLoopDetail(page, proposalId)
    } finally {
      if (emailId) await deleteInboxEmail(request, token, emailId)
    }
  })

  test('integration detail opens the assistant with the current integration id', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)
    const token = await getAuthToken(request, 'admin')
    const integrationId = await pickIntegrationId(request, token)
    test.skip(!integrationId, 'No integration provider modules registered')

    await login(page, 'admin')
    await page.goto(`/backend/integrations/${integrationId}`, { waitUntil: 'domcontentloaded' })
    await expectOperatingLoopDetail(page, integrationId!)
  })
})
