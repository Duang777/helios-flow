const createForFeatureMock = jest.fn(async () => {})
const resolveNotificationServiceMock = jest.fn(() => ({ createForFeature: createForFeatureMock }))
const buildFeatureNotificationFromTypeMock = jest.fn(
  (typeDef: Record<string, unknown>, input: Record<string, unknown>) => ({
    type: typeDef.type,
    ...input,
  }),
)
const loggerErrorMock = jest.fn()

jest.mock('@helios/core/modules/notifications/lib/notificationService', () => ({
  resolveNotificationService: (...args: unknown[]) => resolveNotificationServiceMock(...args),
}))

jest.mock('@helios/core/modules/notifications/lib/notificationBuilder', () => ({
  buildFeatureNotificationFromType: (...args: unknown[]) => buildFeatureNotificationFromTypeMock(...args),
}))

jest.mock('../../notifications', () => ({
  notificationTypes: [
    {
      type: 'governance.rules.digest',
      module: 'governance',
      titleKey: 'governance.notifications.rules.digest.title',
      bodyKey: 'governance.notifications.rules.digest.body',
    },
  ],
}))

jest.mock('@helios/shared/lib/logger', () => {
  const mocked = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: loggerErrorMock,
    child: jest.fn(),
  }
  mocked.child.mockImplementation(() => mocked)
  return { createLogger: jest.fn(() => mocked) }
})

import handle from '../../subscribers/rules-digest-notification'

describe('governance.rules-digest-notification subscriber', () => {
  const em = {
    count: jest.fn(),
  }
  const ctx = {
    resolve: jest.fn((name: string) => {
      if (name === 'em') return em
      throw new Error(`unexpected resolve: ${name}`)
    }),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a digest notification for open critical findings', async () => {
    em.count.mockResolvedValueOnce(2)

    await handle(
      {
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        asOf: '2026-08-31',
      },
      ctx,
    )

    expect(resolveNotificationServiceMock).toHaveBeenCalledTimes(1)
    expect(buildFeatureNotificationFromTypeMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'governance.rules.digest' }),
      expect.objectContaining({
        requiredFeature: 'governance.view',
        bodyVariables: {
          criticalCount: '2',
          asOf: '2026-08-31',
        },
        sourceEntityType: 'governance.rules',
        sourceEntityId: 'org-1',
        linkHref: '/backend/governance/findings?status=open&severity=critical',
        groupKey: 'governance.rules:org-1:2026-08-31',
      }),
    )
    expect(createForFeatureMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'governance.rules.digest' }),
      { tenantId: 'tenant-1', organizationId: 'org-1' },
    )
    expect(loggerErrorMock).not.toHaveBeenCalled()
  })

  it('does nothing when there are no open critical findings', async () => {
    em.count.mockResolvedValueOnce(0)

    await handle(
      {
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        asOf: '2026-08-31',
      },
      ctx,
    )

    expect(resolveNotificationServiceMock).not.toHaveBeenCalled()
    expect(buildFeatureNotificationFromTypeMock).not.toHaveBeenCalled()
    expect(createForFeatureMock).not.toHaveBeenCalled()
  })
})
