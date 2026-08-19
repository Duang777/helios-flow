import type { NotificationTypeDefinition } from '@helios/shared/modules/notifications/types'
import {
  OPERATING_LOOP_DIGEST_LINK,
  OPERATING_LOOP_DIGEST_NOTIFICATION_TYPE,
} from './lib/operatingLoopDigest'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: OPERATING_LOOP_DIGEST_NOTIFICATION_TYPE,
    module: 'insights',
    titleKey: 'insights.notifications.operatingLoop.digest.title',
    bodyKey: 'insights.notifications.operatingLoop.digest.body',
    icon: 'sparkles',
    severity: 'warning',
    actions: [
      {
        id: 'view',
        labelKey: 'common.view',
        variant: 'outline',
        href: OPERATING_LOOP_DIGEST_LINK,
        icon: 'external-link',
      },
    ],
    primaryActionId: 'view',
    linkHref: OPERATING_LOOP_DIGEST_LINK,
    expiresAfterHours: 24,
  },
]

export default notificationTypes
