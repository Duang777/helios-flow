"use client"
import { NotificationBell } from '@helios/ui/backend/notifications'
import { getNotificationRenderers } from '@/.helios/generated/notifications.client.generated'
import { useT } from '@helios/shared/lib/i18n/context'

const notificationRenderers = getNotificationRenderers()

export function NotificationBellWrapper() {
  const t = useT()
  return <NotificationBell t={t} customRenderers={notificationRenderers} />
}
