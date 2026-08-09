import type { NotificationHandler } from '@helios/shared/modules/notifications/handler'

function resolveNotificationText(
  notification: {
    title: string
    body?: string | null
    titleKey?: string | null
    bodyKey?: string | null
    titleVariables?: Record<string, string> | null
    bodyVariables?: Record<string, string> | null
  },
  t?: (key: string, fallback?: string, variables?: Record<string, string>) => string,
) {
  const title = notification.titleKey
    ? t?.(notification.titleKey, notification.title, notification.titleVariables ?? undefined) ?? notification.title
    : notification.title
  const body = notification.bodyKey
    ? t?.(notification.bodyKey, notification.body ?? notification.bodyKey ?? '', notification.bodyVariables ?? undefined) ?? notification.body ?? undefined
    : notification.body ?? undefined
  return { title, body }
}

export const GOVERNANCE_RULES_DIGEST_EVENT = 'om:governance:rules-digest'

export const notificationHandlers: NotificationHandler[] = [
  {
    id: 'governance.rules.digest-toast',
    notificationType: 'governance.rules.digest',
    features: ['governance.view'],
    priority: 120,
    handle(notification, context) {
      const text = resolveNotificationText(notification, context.t)
      context.toast({
        title: text.title,
        body: text.body,
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
