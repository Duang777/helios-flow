import { test, expect } from '@playwright/test'
import { getAuthToken, apiRequest } from '@helios/core/helpers/integration/api'
import { getTokenContext, expectId } from '@helios/core/helpers/integration/generalFixtures'

/**
 * TC-INS-001: KPI target CRUD + completion matches commercial seed
 * Source: .ai/specs/2026-08-08-insights-kpi-and-governance.md
 */
test.describe('TC-INS-001: Insights KPI completion', () => {
  test('creates revenue target, seeds commercial facts, reads completion', async ({ request }) => {
    const token = await getAuthToken(request, 'admin')
    const { organizationId, tenantId } = getTokenContext(token)
    const suffix = Date.now().toString(36)

    let projectId: string | null = null
    let revenueId: string | null = null
    let kpiTargetId: string | null = null

    try {
      const createProject = await apiRequest(request, 'POST', '/api/projects/projects', {
        token,
        data: {
          organizationId,
          tenantId,
          name: `QA INS Project ${suffix}`,
          status: 'active',
          isActive: true,
        },
      })
      expect(createProject.ok(), `create project failed: ${createProject.status()}`).toBeTruthy()
      const createdProject = (await createProject.json()) as { id?: string }
      projectId = expectId(createdProject.id, 'project id missing')

      const createRevenue = await apiRequest(request, 'POST', '/api/commercial/revenues', {
        token,
        data: {
          organizationId,
          tenantId,
          projectId,
          amount: '800.00',
          recognizedOn: '2026-08-15',
          dataVersion: 'actual',
          currencyCode: 'CNY',
        },
      })
      expect(createRevenue.ok(), `create revenue failed: ${createRevenue.status()}`).toBeTruthy()
      const createdRevenue = (await createRevenue.json()) as { id?: string }
      revenueId = expectId(createdRevenue.id, 'revenue id missing')

      const createTarget = await apiRequest(request, 'POST', '/api/insights/kpi-targets', {
        token,
        data: {
          organizationId,
          tenantId,
          metricKey: 'revenue',
          unit: 'amount',
          periodType: 'month',
          periodKey: '2026-08',
          targetValue: '1000.00',
          currencyCode: 'CNY',
        },
      })
      expect(createTarget.ok(), `create kpi target failed: ${createTarget.status()}`).toBeTruthy()
      const createdTarget = (await createTarget.json()) as { id?: string }
      kpiTargetId = expectId(createdTarget.id, 'kpi target id missing')

      const completion = await apiRequest(
        request,
        'GET',
        `/api/insights/kpi/completion?organizationId=${organizationId}&periodType=month&periodKey=2026-08&asOf=2026-08-31`,
        { token },
      )
      expect(completion.ok(), `completion failed: ${completion.status()}`).toBeTruthy()
      const body = (await completion.json()) as {
        items?: Array<{
          metricKey?: string
          targetValue?: string | null
          actualValue?: string | null
          completionRate?: string | null
          actualSource?: string
        }>
        asOf?: string
      }
      const revenueRow = body.items?.find((row) => row.metricKey === 'revenue')
      expect(revenueRow?.actualValue).toBe('800.00')
      expect(revenueRow?.targetValue).toBe('1000.00')
      expect(revenueRow?.completionRate).toBe('80.00')
      expect(revenueRow?.actualSource).toBe('commercial.metrics')
      expect(body.asOf).toBe('2026-08-31')
    } finally {
      if (kpiTargetId) {
        await apiRequest(request, 'DELETE', `/api/insights/kpi-targets?id=${kpiTargetId}`, { token })
      }
      if (revenueId) {
        await apiRequest(request, 'DELETE', `/api/commercial/revenues?id=${revenueId}`, { token })
      }
      if (projectId) {
        await apiRequest(request, 'DELETE', `/api/projects/projects?id=${projectId}`, { token })
      }
    }
  })
})
