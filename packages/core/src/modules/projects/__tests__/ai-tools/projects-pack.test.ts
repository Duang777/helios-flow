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

import projectsAiTools from '../../ai-tools/projects-pack'
import features from '../../acl'

const knownFeatureIds = new Set(features.map((entry) => entry.id))

function findTool(name: string) {
  const tool = projectsAiTools.find((entry) => entry.name === name)
  if (!tool) throw new Error(`tool ${name} missing`)
  return tool
}

function makeCtx() {
  return {
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    userId: 'user-1',
    container: { resolve: jest.fn() },
    userFeatures: ['projects.view'],
    isSuperAdmin: false,
  }
}

describe('projects.get_delay_summary', () => {
  beforeEach(() => {
    runMock.mockReset()
    createRunnerMock.mockClear()
  })

  it('declares an existing view feature', () => {
    const tool = findTool('projects.get_delay_summary')
    expect(tool.requiredFeatures).toEqual(['projects.view'])
    for (const feature of tool.requiredFeatures ?? []) expect(knownFeatureIds.has(feature)).toBe(true)
  })

  it('summarizes delayed milestones from the API response', async () => {
    const tool = findTool('projects.get_delay_summary')
    runMock.mockResolvedValue({
      success: true,
      statusCode: 200,
      data: {
        items: [
          {
            id: 'ms-1',
            projectId: '33333333-3333-4333-8333-333333333333',
            name: 'Launch',
            status: 'planned',
            plannedDate: '2026-08-01',
            actualDate: null,
          },
          {
            id: 'ms-2',
            projectId: '33333333-3333-4333-8333-333333333333',
            name: 'Done',
            status: 'done',
            plannedDate: '2026-08-01',
            actualDate: '2026-08-02',
          },
        ],
        total: 2,
      },
    })

    const result = (await tool.handler(
      {
        projectId: '33333333-3333-4333-8333-333333333333',
        asOf: '2026-08-31',
      },
      makeCtx() as never,
    )) as Record<string, unknown>

    expect(runMock.mock.calls[0][0]).toMatchObject({
      method: 'GET',
      path: '/projects/milestones',
      query: {
        projectId: '33333333-3333-4333-8333-333333333333',
        page: 1,
        pageSize: 100,
      },
    })
    expect(result.delayedCount).toBe(1)
    const delayed = result.delayedMilestones as Array<Record<string, unknown>>
    expect(delayed[0]).toMatchObject({
      id: 'ms-1',
      isDelayed: true,
      href: '/backend/milestones/ms-1',
    })
    expect(result.formulaSource).toContain('projects.lib.milestoneDelay')
  })
})
