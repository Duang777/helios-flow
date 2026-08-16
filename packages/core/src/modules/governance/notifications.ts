import type { NotificationTypeDefinition } from '@helios/shared/modules/notifications/types'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'governance.rules.digest',
    module: 'governance',
    titleKey: 'governance.notifications.rules.digest.title',
    bodyKey: 'governance.notifications.rules.digest.body',
    icon: 'shield-alert',
    severity: 'warning',
    actions: [
      {
        id: 'view',
        labelKey: 'common.view',
        variant: 'outline',
        href: '/backend/governance/findings?status=open&severity=critical',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/governance/findings?status=open&severity=critical',
    expiresAfterHours: 24,
  },
]

export default notificationTypes
