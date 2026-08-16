import { test, expect } from '@playwright/test'
import { getAuthToken, apiRequest } from '@helios/core/helpers/integration/api'
import { getTokenContext, expectId } from '@helios/core/helpers/integration/generalFixtures'

/**
 * TC-PRJ-001: Projects delivery CRUD (project → milestone → risk)
 * Source: .ai/specs/2026-08-07-projects-delivery-module.md Phase B
 *
 * Self-contained API fixtures; cleans up created rows in finally.
 */
test.describe('TC-PRJ-001: Projects delivery CRUD', () => {
  test('creates project, milestone, risk then soft-deletes them', async ({ request }) => {
    const token = await getAuthToken(request, 'admin')
    const { organizationId, tenantId } = getTokenContext(token)
    const suffix = Date.now().toString(36)

    let projectId: string | null = null
    let milestoneId: string | null = null
    let riskId: string | null = null

    try {
      const createProject = await apiRequest(request, 'POST', '/api/projects/projects', {
        token,
        data: {
          organizationId,
          tenantId,
          name: `QA Delivery Project ${suffix}`,
          code: `QA-PRJ-${suffix}`,
          status: 'active',
          isActive: true,
        },
      })
      expect(createProject.ok(), `create project failed: ${createProject.status()}`).toBeTruthy()
      const createdProject = (await createProject.json()) as { id?: string }
      projectId = expectId(createdProject.id, 'project id missing')

      const listProjects = await apiRequest(
        request,
        'GET',
        `/api/projects/projects?id=${projectId}`,
        { token },
      )
      expect(listProjects.ok()).toBeTruthy()
      const projectBody = (await listProjects.json()) as {
        items?: Array<{ id?: string; name?: string; updatedAt?: string }>
      }
      expect(projectBody.items?.[0]?.id).toBe(projectId)
      expect(projectBody.items?.[0]?.name).toContain('QA Delivery Project')
      expect(projectBody.items?.[0]?.updatedAt).toBeTruthy()

      const createMilestone = await apiRequest(request, 'POST', '/api/projects/milestones', {
        token,
        data: {
          organizationId,
          tenantId,
          projectId,
          name: `QA Milestone ${suffix}`,
          status: 'planned',
          plannedDate: '2020-01-01',
          actualDate: null,
        },
      })
      expect(createMilestone.ok(), `create milestone failed: ${createMilestone.status()}`).toBeTruthy()
      const createdMilestone = (await createMilestone.json()) as { id?: string }
      milestoneId = expectId(createdMilestone.id, 'milestone id missing')

      const listMilestones = await apiRequest(
        request,
        'GET',
        `/api/projects/milestones?projectId=${projectId}`,
        { token },
      )
      expect(listMilestones.ok()).toBeTruthy()
      const milestoneBody = (await listMilestones.json()) as {
        items?: Array<{ id?: string; isDelayed?: boolean }>
      }
      const milestoneRow = milestoneBody.items?.find((row) => row.id === milestoneId)
      expect(milestoneRow).toBeTruthy()
      expect(milestoneRow?.isDelayed).toBe(true)

      const createRisk = await apiRequest(request, 'POST', '/api/projects/risks', {
        token,
        data: {
          organizationId,
          tenantId,
          projectId,
          title: `QA Risk ${suffix}`,
          riskType: 'schedule',
          status: 'open',
        },
      })
      expect(createRisk.ok(), `create risk failed: ${createRisk.status()}`).toBeTruthy()
      const createdRisk = (await createRisk.json()) as { id?: string }
      riskId = expectId(createdRisk.id, 'risk id missing')

      const listRisks = await apiRequest(
        request,
        'GET',
        `/api/projects/risks?projectId=${projectId}`,
        { token },
      )
      expect(listRisks.ok()).toBeTruthy()
      const riskBody = (await listRisks.json()) as { items?: Array<{ id?: string }> }
      expect(riskBody.items?.some((row) => row.id === riskId)).toBe(true)
    } finally {
      if (riskId) {
        await apiRequest(request, 'DELETE', `/api/projects/risks?id=${riskId}`, { token })
      }
      if (milestoneId) {
        await apiRequest(request, 'DELETE', `/api/projects/milestones?id=${milestoneId}`, {
          token,
        })
      }
      if (projectId) {
        await apiRequest(request, 'DELETE', `/api/projects/projects?id=${projectId}`, { token })
      }
    }
  })
})
