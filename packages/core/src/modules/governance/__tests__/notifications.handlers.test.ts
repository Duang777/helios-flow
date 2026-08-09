import { notificationHandlers } from '../notifications.handlers'

describe('governance notifications handlers', () => {
  it('translates the rules digest toast copy before showing the toast', () => {
    const toast = jest.fn()
    const navigate = jest.fn()
    const emitEvent = jest.fn()
    const refreshNotifications = jest.fn()
    const t = jest.fn((key: string, fallback?: string) => `${key}::${fallback ?? ''}`)

    const handler = notificationHandlers.find((entry) => entry.id === 'governance.rules.digest-toast')
    expect(handler).toBeTruthy()

    handler?.handle(
      {
        id: 'n1',
        type: 'governance.rules.digest',
        title: 'governance.notifications.rules.digest.title',
        body: 'governance.notifications.rules.digest.body',
        titleKey: 'governance.notifications.rules.digest.title',
        bodyKey: 'governance.notifications.rules.digest.body',
        titleVariables: null,
        bodyVariables: { criticalCount: '3', asOf: '2026-08-31' },
        severity: 'warning',
        status: 'unread',
        actions: [],
        createdAt: '2026-08-09T00:00:00.000Z',
      } as never,
      {
        t,
        toast,
        navigate,
        emitEvent,
        refreshNotifications,
      } as never,
    )

    expect(t).toHaveBeenCalledWith(
      'governance.notifications.rules.digest.title',
      'governance.notifications.rules.digest.title',
      undefined,
    )
    expect(t).toHaveBeenCalledWith(
      'governance.notifications.rules.digest.body',
      'governance.notifications.rules.digest.body',
      { criticalCount: '3', asOf: '2026-08-31' },
    )
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'governance.notifications.rules.digest.title::governance.notifications.rules.digest.title',
        body: 'governance.notifications.rules.digest.body::governance.notifications.rules.digest.body',
        severity: 'warning',
      }),
    )
    expect(emitEvent).toHaveBeenCalledWith('om:governance:rules-digest', {
      notificationId: 'n1',
      sourceEntityId: null,
    })
    expect(refreshNotifications).toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
