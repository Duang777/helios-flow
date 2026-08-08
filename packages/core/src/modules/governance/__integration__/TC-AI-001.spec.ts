import { test, expect } from '@playwright/test'
import { getAuthToken, apiRequest } from '@helios/core/helpers/integration/api'

/**
 * TC-AI-001: Operating-loop AI agents and tools are registered and visible to admin.
 */
test.describe('TC-AI-001: Operating-loop AI registry', () => {
  test('lists projects/commercial/insights/governance agents and key tools', async ({ request }) => {
    const token = await getAuthToken(request, 'admin')

    const agentsRes = await apiRequest(request, 'GET', '/api/ai_assistant/ai/agents', { token })
    expect(agentsRes.ok(), await agentsRes.text()).toBeTruthy()
    const agentsBody = (await agentsRes.json()) as {
      agents?: Array<{ id?: string; moduleId?: string; allowedTools?: string[]; readOnly?: boolean }>
    }
    const ids = new Set((agentsBody.agents ?? []).map((row) => row.id).filter(Boolean))
    expect(ids.has('projects.delivery_assistant')).toBeTruthy()
    expect(ids.has('commercial.settlement_assistant')).toBeTruthy()
    expect(ids.has('insights.kpi_assistant')).toBeTruthy()
    expect(ids.has('governance.assistant')).toBeTruthy()

    const commercial = (agentsBody.agents ?? []).find((row) => row.id === 'commercial.settlement_assistant')
    const insights = (agentsBody.agents ?? []).find((row) => row.id === 'insights.kpi_assistant')
    const governance = (agentsBody.agents ?? []).find((row) => row.id === 'governance.assistant')
    expect(commercial?.allowedTools ?? []).toEqual(
      expect.arrayContaining([
        'commercial.list_contracts',
        'commercial.list_invoices',
        'commercial.list_payments',
        'commercial.get_metrics',
      ]),
    )
    expect(insights?.allowedTools ?? []).toEqual(
      expect.arrayContaining(['insights.list_kpi_targets', 'insights.get_kpi_completion']),
    )
    expect(governance?.allowedTools ?? []).toEqual(
      expect.arrayContaining([
        'governance.list_findings',
        'governance.list_identity_maps',
        'governance.acknowledge_finding',
      ]),
    )
    expect(governance?.readOnly).toBe(false)
  })
})
