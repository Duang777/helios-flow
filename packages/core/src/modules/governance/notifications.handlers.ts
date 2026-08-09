import type { NotificationHandler } from '@helios/shared/modules/notifications/handler'

export const GOVERNANCE_RULES_DIGEST_EVENT = 'om:governance:rules-digest'

export const notificationHandlers: NotificationHandler[] = [
  {
    id: 'governance.rules.digest-toast',
    notificationType: 'governance.rules.digest',
    features: ['governance.view'],
    priority: 120,
    handle(notification, context) {
      context.toast({
        title: notification.title,
        body: notification.body ?? undefined,
        severity: 'warning',
        action: {
          label: context.t?.('common.view', 'View') ?? 'View',
          onClick: () => context.navigate('/backend/governance/findings?status=open&severity=critical'),
        },
      })
      context.emitEvent(GOVERNANCE_RULES_DIGEST_EVENT, {
        notificationId: notification.id,
        sourceEntityId: notification.sourceEntityId ?? null,
      })
      context.refreshNotifications()
    },
  },
]

export default notificationHandlers
