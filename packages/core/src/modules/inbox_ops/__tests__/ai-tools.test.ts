/** @jest-environment node */

const mockFindOneWithDecryption = jest.fn()
const mockFindWithDecryption = jest.fn()
const mockExecuteAction = jest.fn()
const mockResolveOptionalEventBus = jest.fn()
const mockRunWithCacheTenant = jest.fn(async (_tenantId: string, fn: () => Promise<unknown>) => fn())
const mockResolveCache = jest.fn()
const mockInvalidateCountsCache = jest.fn()

jest.mock('@helios/shared/lib/encryption/find', () => ({
  findOneWithDecryption: (...args: unknown[]) => mockFindOneWithDecryption(...args),
  findWithDecryption: (...args: unknown[]) => mockFindWithDecryption(...args),
}))

jest.mock('@helios/core/modules/inbox_ops/lib/executionEngine', () => ({
  executeAction: (...args: unknown[]) => mockExecuteAction(...args),
}))

jest.mock('@helios/core/modules/inbox_ops/lib/eventBus', () => ({
  resolveOptionalEventBus: (...args: unknown[]) => mockResolveOptionalEventBus(...args),
}))

jest.mock('@helios/cache', () => ({
  runWithCacheTenant: (...args: unknown[]) => mockRunWithCacheTenant(...args),
}))

jest.mock('@helios/core/modules/inbox_ops/lib/cache', () => ({
  resolveCache: (...args: unknown[]) => mockResolveCache(...args),
  invalidateCountsCache: (...args: unknown[]) => mockInvalidateCountsCache(...args),
}))

import aiTools from '../ai-tools'

describe('inbox_ops aiTools', () => {
  it('exports list/get plus a confirm-required accept mutation', () => {
    expect(aiTools.map((tool) => tool.name)).toEqual([
      'inbox_ops_list_proposals',
      'inbox_ops_get_proposal',
      'inbox_ops_accept_action',
      'inbox_ops_categorize_email',
    ])
    const accept = aiTools.find((tool) => tool.name === 'inbox_ops_accept_action')
    expect(accept?.isMutation).toBe(true)
    expect(typeof accept?.loadBeforeRecord).toBe('function')
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockExecuteAction.mockResolvedValue({
      success: true,
      createdEntityId: 'entity-1',
      createdEntityType: 'catalog_product',
    })
    mockResolveOptionalEventBus.mockReturnValue(null)
    mockInvalidateCountsCache.mockResolvedValue(undefined)
  })

  it('invalidates counts cache inside tenant cache context after accepting an action', async () => {
    const em = {
      fork: jest.fn(),
    }
    em.fork.mockReturnValue(em)

    const cache = {
      deleteByTags: jest.fn(),
    }

    const container = {
      resolve: jest.fn((token: string) => {
        if (token === 'em') return em
        throw new Error(`Unknown token: ${token}`)
      }),
    }

    mockFindOneWithDecryption.mockResolvedValueOnce({
      id: 'action-1',
      proposalId: 'proposal-1',
      status: 'pending',
      requiredFeature: null,
      payload: {},
    })
    mockResolveCache.mockReturnValue(cache)

    const tool = aiTools.find((candidate) => candidate.name === 'inbox_ops_accept_action')
    if (!tool) {
      throw new Error('Accept action tool not found')
    }

    const result = await tool.handler(
      { proposalId: 'proposal-1', actionId: 'action-1' } as never,
      {
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        userId: 'user-1',
        container: container as never,
        userFeatures: ['inbox_ops.proposals.manage'],
        isSuperAdmin: false,
      },
    )

    expect(result).toEqual({
      ok: true,
      createdEntityId: 'entity-1',
      createdEntityType: 'catalog_product',
      href: '/backend/inbox-ops/proposals/proposal-1',
    })
    expect(mockRunWithCacheTenant).toHaveBeenCalledWith('tenant-1', expect.any(Function))
    expect(mockInvalidateCountsCache).toHaveBeenCalledWith(cache, 'tenant-1')
  })

  it('accepts action-required features granted via wildcard ACL', async () => {
    const em = {
      fork: jest.fn(),
    }
    em.fork.mockReturnValue(em)

    const container = {
      resolve: jest.fn((token: string) => {
        if (token === 'em') return em
        throw new Error(`Unknown token: ${token}`)
      }),
    }

    mockFindOneWithDecryption.mockResolvedValueOnce({
      id: 'action-1',
      proposalId: 'proposal-1',
      status: 'pending',
      requiredFeature: 'catalog.products.manage',
      payload: {},
    })

    const tool = aiTools.find((candidate) => candidate.name === 'inbox_ops_accept_action')
    if (!tool) {
      throw new Error('Accept action tool not found')
    }

    const result = await tool.handler(
      { proposalId: 'proposal-1', actionId: 'action-1' } as never,
      {
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        userId: 'user-1',
        container: container as never,
        userFeatures: ['catalog.*'],
        isSuperAdmin: false,
      },
    )

    expect(result).toEqual({
      ok: true,
      createdEntityId: 'entity-1',
      createdEntityType: 'catalog_product',
      href: '/backend/inbox-ops/proposals/proposal-1',
    })
  })

  it('previews a pending action without executing it', async () => {
    const em = {
      fork: jest.fn(),
    }
    em.fork.mockReturnValue(em)

    const container = {
      resolve: jest.fn((token: string) => {
        if (token === 'em') return em
        throw new Error(`Unknown token: ${token}`)
      }),
    }

    mockFindOneWithDecryption.mockResolvedValueOnce({
      id: 'action-1',
      proposalId: 'proposal-1',
      actionType: 'create_order',
      description: 'Create sales order',
      status: 'pending',
      requiredFeature: null,
      matchedEntityType: null,
      updatedAt: new Date('2026-08-19T00:00:00.000Z'),
    })

    const tool = aiTools.find((candidate) => candidate.name === 'inbox_ops_accept_action')
    if (!tool?.loadBeforeRecord) {
      throw new Error('Accept action preview is missing')
    }

    const preview = await tool.loadBeforeRecord(
      { proposalId: 'proposal-1', actionId: 'action-1' } as never,
      {
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        userId: 'user-1',
        container: container as never,
        userFeatures: ['inbox_ops.proposals.manage'],
        isSuperAdmin: false,
      },
    )

    expect(preview).toEqual({
      recordId: 'action-1',
      entityType: 'inbox_ops.proposal_action',
      recordVersion: '2026-08-19T00:00:00.000Z',
      before: {
        proposalId: 'proposal-1',
        actionType: 'create_order',
        description: 'Create sales order',
        status: 'pending',
        requiredFeature: null,
        matchedEntityType: null,
      },
      after: {
        proposalId: 'proposal-1',
        actionType: 'create_order',
        description: 'Create sales order',
        status: 'accepted',
        requiredFeature: null,
        matchedEntityType: null,
      },
    })
    expect(mockExecuteAction).not.toHaveBeenCalled()
  })

  it('lists proposals with list and record hrefs even when the inbox is empty', async () => {
    const em = {
      fork: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    }
    em.fork.mockReturnValue(em)

    mockFindWithDecryption.mockResolvedValueOnce([])

    const tool = aiTools.find((candidate) => candidate.name === 'inbox_ops_list_proposals')
    if (!tool) {
      throw new Error('List proposals tool not found')
    }

    const result = await tool.handler(
      { limit: 10 } as never,
      {
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        userId: 'user-1',
        container: { resolve: jest.fn((token: string) => {
          if (token === 'em') return em
          throw new Error(`Unknown token: ${token}`)
        }) } as never,
        userFeatures: ['inbox_ops.proposals.view'],
        isSuperAdmin: false,
      },
    )

    expect(result).toEqual({
      total: 0,
      href: '/backend/inbox-ops',
      proposals: [],
    })
  })

  it('returns proposal hrefs from list and get tools', async () => {
    const createdAt = new Date('2026-08-19T00:00:00.000Z')
    const em = {
      fork: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
    }
    em.fork.mockReturnValue(em)

    mockFindWithDecryption
      .mockResolvedValueOnce([
        {
          id: 'proposal-1',
          summary: 'Create contact from inbound mail',
          status: 'pending',
          category: 'inquiry',
          confidence: 0.91,
          createdAt,
        },
      ])
      .mockResolvedValueOnce([{ proposalId: 'proposal-1' }])
      .mockResolvedValueOnce([
        {
          id: 'action-1',
          actionType: 'create_contact',
          description: 'Create contact',
          status: 'pending',
          confidence: 0.9,
          requiredFeature: null,
          sortOrder: 0,
          createdEntityId: null,
          createdEntityType: null,
        },
      ])
      .mockResolvedValueOnce([])
    mockFindOneWithDecryption.mockResolvedValueOnce({
      id: 'proposal-1',
      summary: 'Create contact from inbound mail',
      status: 'pending',
      category: 'inquiry',
      confidence: 0.91,
    })

    const listTool = aiTools.find((candidate) => candidate.name === 'inbox_ops_list_proposals')
    const getTool = aiTools.find((candidate) => candidate.name === 'inbox_ops_get_proposal')
    if (!listTool || !getTool) {
      throw new Error('Inbox proposal read tools not found')
    }

    const ctx = {
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      userId: 'user-1',
      container: { resolve: jest.fn((token: string) => {
        if (token === 'em') return em
        throw new Error(`Unknown token: ${token}`)
      }) } as never,
      userFeatures: ['inbox_ops.proposals.view'],
      isSuperAdmin: false,
    }

    const listed = await listTool.handler({ limit: 10 } as never, ctx)
    expect(listed).toEqual({
      total: 1,
      href: '/backend/inbox-ops',
      proposals: [
        {
          id: 'proposal-1',
          summary: 'Create contact from inbound mail',
          status: 'pending',
          category: 'inquiry',
          confidence: 0.91,
          actionCount: 1,
          createdAt: createdAt.toISOString(),
          href: '/backend/inbox-ops/proposals/proposal-1',
        },
      ],
    })

    const detail = await getTool.handler({ proposalId: 'proposal-1' } as never, ctx)
    expect(detail).toEqual({
      proposal: {
        id: 'proposal-1',
        summary: 'Create contact from inbound mail',
        status: 'pending',
        category: 'inquiry',
        confidence: 0.91,
        href: '/backend/inbox-ops/proposals/proposal-1',
        actions: [
          {
            id: 'action-1',
            actionType: 'create_contact',
            description: 'Create contact',
            status: 'pending',
            confidence: 0.9,
            requiredFeature: null,
            sortOrder: 0,
            createdEntityId: null,
            createdEntityType: null,
          },
        ],
        discrepancies: [],
      },
    })
  })
})
