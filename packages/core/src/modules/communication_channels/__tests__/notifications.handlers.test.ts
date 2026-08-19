import { notificationHandlers } from '../notifications.handlers'

describe('communication_channels notifications handlers', () => {
  it('translates the reauth toast copy before showing the toast', () => {
    const toast = jest.fn()
    const navigate = jest.fn()
    const emitEvent = jest.fn()
    const refreshNotifications = jest.fn()
    const t = jest.fn((key: string, fallback?: string) => `${key}::${fallback ?? ''}`)

    const handler = notificationHandlers.find(
      (entry) => entry.id === 'communication_channels.channel-requires-reauth-toast',
    )
    expect(handler).toBeTruthy()

    handler?.handle(
      {
        id: 'n1',
        type: 'communication_channels.channel.requires_reauth',
        title: 'communication_channels.notifications.channel_requires_reauth.title',
        body: 'communication_channels.notifications.channel_requires_reauth.body',
        titleKey: 'communication_channels.notifications.channel_requires_reauth.title',
        bodyKey: 'communication_channels.notifications.channel_requires_reauth.body',
        titleVariables: null,
        bodyVariables: null,
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

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'communication_channels.notifications.channel_requires_reauth.title::communication_channels.notifications.channel_requires_reauth.title',
        body: 'communication_channels.notifications.channel_requires_reauth.body::communication_channels.notifications.channel_requires_reauth.body',
        severity: 'warning',
      }),
    )
    expect(emitEvent).toHaveBeenCalledWith('om:communication_channels:channel-requires-reauth', {
      notificationId: 'n1',
      channelId: null,
    })
    expect(refreshNotifications).toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
