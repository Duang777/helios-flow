import { test, expect } from '@playwright/test'
import { getAuthToken, apiRequest } from '@helios/core/helpers/integration/api'
import { getTokenContext, expectId } from '@helios/core/helpers/integration/generalFixtures'

/**
 * TC-GOV-001: Identity map keeps source + delayed milestone finding
 * Source: .ai/specs/2026-08-08-insights-kpi-and-governance.md
 */
test.describe('TC-GOV-001: Governance rules + identity map', () => {
  test('creates identity map, seeds delayed milestone, runs rules', async ({ request }) => {
    const token = await getAuthToken(request, 'admin')
    const { organizationId, tenantId } = getTokenContext(token)
    const suffix = Date.now().toString(36)

    let sourceEntityId: string | null = null
    let canonicalEntityId: string | null = null
    let identityMapId: string | null = null
    let projectId: string | null = null
    let milestoneId: string | null = null

    try {
      const createSource = await apiRequest(request, 'POST', '/api/customers/companies', {
        token,
        data: {
          organizationId,
          tenantId,
          displayName: `QA GOV Source ${suffix}`,
          isActive: true,
        },
      })
      expect(createSource.ok(), `create source company failed: ${createSource.status()}`).toBeTruthy()
      const sourceBody = (await createSource.json()) as { id?: string; entityId?: string }
      sourceEntityId = expectId(sourceBody.entityId ?? sourceBody.id, 'source entity id missing')

      const createCanonical = await apiRequest(request, 'POST', '/api/customers/companies', {
        token,
        data: {
          organizationId,
          tenantId,
          displayName: `QA GOV Canonical ${suffix}`,
          isActive: true,
        },
      })
      expect(createCanonical.ok(), `create canonical company failed: ${createCanonical.status()}`).toBeTruthy()
      const canonicalBody = (await createCanonical.json()) as { id?: string; entityId?: string }
      canonicalEntityId = expectId(canonicalBody.entityId ?? canonicalBody.id, 'canonical entity id missing')

      const createMap = await apiRequest(request, 'POST', '/api/governance/identity-maps', {
        token,
        data: {
          organizationId,
          tenantId,
          sourceEntityId,
          canonicalEntityId,
          rationale: 'QA duplicate mapping — source row kept',
        },
      })
      expect(createMap.ok(), `create identity map failed: ${createMap.status()}`).toBeTruthy()
      const mapBody = (await createMap.json()) as { id?: string }
      identityMapId = expectId(mapBody.id, 'identity map id missing')

      const verifySource = await apiRequest(
        request,
        'GET',
        `/api/customers/companies?id=${sourceEntityId}`,
        { token },
      )
      expect(verifySource.ok(), 'source entity should still exist').toBeTruthy()

      const createProject = await apiRequest(request, 'POST', '/api/projects/projects', {
        token,
        data: {
          organizationId,
          tenantId,
          name: `QA GOV Project ${suffix}`,
          status: 'active',
          isActive: true,
        },
      })
      expect(createProject.ok(), `create project failed: ${createProject.status()}`).toBeTruthy()
      const projectBody = (await createProject.json()) as { id?: string }
      projectId = expectId(projectBody.id, 'project id missing')

      const createMilestone = await apiRequest(request, 'POST', '/api/projects/milestones', {
        token,
        data: {
          organizationId,
          tenantId,
          projectId,
          name: `QA Delayed Milestone ${suffix}`,
          plannedDate: '2026-08-01',
          status: 'planned',
          isActive: true,
        },
      })
      expect(createMilestone.ok(), `create milestone failed: ${createMilestone.status()}`).toBeTruthy()
      const milestoneBody = (await createMilestone.json()) as { id?: string }
      milestoneId = expectId(milestoneBody.id, 'milestone id missing')

      const runRules = await apiRequest(request, 'POST', '/api/governance/rules/run', {
        token,
        data: {
          organizationId,
          tenantId,
          asOf: '2026-08-08',
        },
      })
      expect(runRules.ok(), `run rules failed: ${runRules.status()}`).toBeTruthy()
      const runBody = (await runRules.json()) as { created?: number; candidateCount?: number }
      expect((runBody.created ?? 0) + (runBody.candidateCount ?? 0)).toBeGreaterThan(0)

      const findings = await apiRequest(
        request,
        'GET',
        `/api/governance/findings?ruleId=gov.project_milestone_delayed&subjectType=milestone&pageSize=100`,
        { token },
      )
      expect(findings.ok(), `list findings failed: ${findings.status()}`).toBeTruthy()
      const findingsBody = (await findings.json()) as {
        items?: Array<{ subjectId?: string; ruleId?: string }>
      }
      const delayed = findingsBody.items?.find(
        (row) => row.ruleId === 'gov.project_milestone_delayed' && row.subjectId === milestoneId,
      )
      expect(delayed, 'expected delayed milestone finding').toBeTruthy()

      const runAgain = await apiRequest(request, 'POST', '/api/governance/rules/run', {
        token,
        data: {
          organizationId,
          tenantId,
          asOf: '2026-08-08',
        },
      })
      expect(runAgain.ok()).toBeTruthy()
      const againBody = (await runAgain.json()) as { created?: number; updated?: number }
      expect(againBody.created ?? 0).toBe(0)
      expect((againBody.updated ?? 0)).toBeGreaterThan(0)
    } finally {
      if (identityMapId) {
        await apiRequest(request, 'DELETE', `/api/governance/identity-maps?id=${identityMapId}`, { token })
      }
      if (milestoneId) {
        await apiRequest(request, 'DELETE', `/api/projects/milestones?id=${milestoneId}`, { token })
      }
      if (projectId) {
        await apiRequest(request, 'DELETE', `/api/projects/projects?id=${projectId}`, { token })
      }
      if (sourceEntityId) {
        await apiRequest(request, 'DELETE', `/api/customers/companies?id=${sourceEntityId}`, { token })
      }
      if (canonicalEntityId) {
        await apiRequest(request, 'DELETE', `/api/customers/companies?id=${canonicalEntityId}`, { token })
      }
    }
  })
})
