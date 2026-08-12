const runMock = jest.fn()
const createRunnerMock = jest.fn(() => ({ run: runMock }))

jest.mock(
  '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner',
  () => {
    const actual = jest.requireActual(
      '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner',
    )
    return {
      ...actual,
      createAiApiOperationRunner: (...args: unknown[]) => createRunnerMock(...args),
    }
  },
)

import governanceAiTools from '../../ai-tools'
import features from '../../acl'

const knownFeatureIds = new Set(features.map((entry) => entry.id))

function findTool(name: string) {
  const tool = governanceAiTools.find((entry) => entry.name === name)
  if (!tool) throw new Error(`tool ${name} missing`)
  return tool
}

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    userId: 'user-1',
    container: { resolve: jest.fn() },
    userFeatures: ['governance.view', 'governance.manage'],
    isSuperAdmin: false,
    ...overrides,
  }
}

describe('governance disposition AI tools', () => {
  beforeEach(() => {
    runMock.mockReset()
    createRunnerMock.mockClear()
  })

  it('declares confirm-required mutation tools using existing manage feature', () => {
    for (const name of [
      'governance.acknowledge_finding',
      'governance.update_finding_disposition',
      'governance.acknowledge_findings',
      'governance.update_findings_disposition',
    ]) {
      const tool = findTool(name)
      expect(tool.isMutation).toBe(true)
      expect(tool.requiredFeatures).toContain('governance.manage')
      for (const feature of tool.requiredFeatures ?? []) expect(knownFeatureIds.has(feature)).toBe(true)
    }
  })

  it('governance.update_finding_disposition writes status, owner role, and suggested due date through the API runner', async () => {
    const tool = findTool('governance.update_finding_disposition')
    runMock.mockResolvedValue({ success: true, statusCode: 200, data: { ok: true } })

    const result = (await tool.handler(
      {
        findingId: '11111111-1111-4111-8111-111111111111',
        status: 'acknowledged',
        ownerRole: 'finance_ops',
        suggestedDueOn: '2026-09-15',
        impactSummary: 'Outstanding AR needs collection follow-up.',
      },
      makeCtx() as never,
    )) as Record<string, unknown>

    expect(runMock).toHaveBeenCalledTimes(1)
    expect(runMock.mock.calls[0][0]).toMatchObject({
      method: 'PUT',
      path: '/governance/findings',
      body: {
        id: '11111111-1111-4111-8111-111111111111',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        status: 'acknowledged',
        ownerRole: 'finance_ops',
        suggestedDueOn: '2026-09-15',
        impactSummary: 'Outstanding AR needs collection follow-up.',
      },
    })
    expect(result).toEqual({
      ok: true,
      findingId: '11111111-1111-4111-8111-111111111111',
      href: '/backend/governance/findings/11111111-1111-4111-8111-111111111111',
    })
  })

  it('governance.acknowledge_findings batches PUT operations and reports per-record results', async () => {
    const tool = findTool('governance.acknowledge_findings')
    runMock
      .mockResolvedValueOnce({ success: true, statusCode: 200, data: { ok: true } })
      .mockResolvedValueOnce({ success: false, statusCode: 404, error: 'Finding not found' })

    const result = (await tool.handler(
      {
        findingIds: [
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
        ],
      },
      makeCtx() as never,
    )) as Record<string, unknown>

    expect(runMock).toHaveBeenCalledTimes(2)
    expect(runMock.mock.calls[0][0].body.status).toBe('acknowledged')
    const records = result.records as Array<Record<string, unknown>>
    expect(records[0]).toMatchObject({
      recordId: '11111111-1111-4111-8111-111111111111',
      status: 'updated',
    })
    expect(records[1]).toMatchObject({
      recordId: '22222222-2222-4222-8222-222222222222',
      status: 'failed',
      error: { code: 'api_error', message: 'Finding not found' },
    })
  })

  it('governance.update_findings_disposition applies per-record owner, due date, status, and impact patches', async () => {
    const tool = findTool('governance.update_findings_disposition')
    runMock
      .mockResolvedValueOnce({ success: true, statusCode: 200, data: { ok: true } })
      .mockResolvedValueOnce({ success: false, statusCode: 409, error: 'Record changed' })

    const result = (await tool.handler(
      {
        records: [
          {
            findingId: '11111111-1111-4111-8111-111111111111',
            status: 'acknowledged',
            ownerRole: 'finance_ops',
            suggestedDueOn: '2026-09-15',
            impactSummary: 'AR collection follow-up required.',
          },
          {
            findingId: '22222222-2222-4222-8222-222222222222',
            status: 'resolved',
            ownerRole: 'project_manager',
          },
        ],
      },
      makeCtx() as never,
    )) as Record<string, unknown>

    expect(runMock).toHaveBeenCalledTimes(2)
    expect(runMock.mock.calls[0][0]).toMatchObject({
      method: 'PUT',
      path: '/governance/findings',
      body: {
        id: '11111111-1111-4111-8111-111111111111',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        status: 'acknowledged',
        ownerRole: 'finance_ops',
        suggestedDueOn: '2026-09-15',
        impactSummary: 'AR collection follow-up required.',
      },
    })
    expect(runMock.mock.calls[1][0]).toMatchObject({
      body: {
        id: '22222222-2222-4222-8222-222222222222',
        status: 'resolved',
        ownerRole: 'project_manager',
      },
    })
    const records = result.records as Array<Record<string, unknown>>
    expect(records[0]).toMatchObject({
      recordId: '11111111-1111-4111-8111-111111111111',
      status: 'updated',
      href: '/backend/governance/findings/11111111-1111-4111-8111-111111111111',
    })
    expect(records[1]).toMatchObject({
      recordId: '22222222-2222-4222-8222-222222222222',
      status: 'failed',
      error: { code: 'api_error', message: 'Record changed' },
    })
    expect(result.failedRecordIds).toEqual(['22222222-2222-4222-8222-222222222222'])
  })
})
