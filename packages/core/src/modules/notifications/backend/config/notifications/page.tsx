import { Page, PageBody } from '@helios/ui/backend/Page'
import { NotificationSettingsPageClient } from '../../../frontend/NotificationSettingsPageClient'

export default async function NotificationSettingsPage() {
  return (
    <Page>
      <PageBody>
        <NotificationSettingsPageClient />
      </PageBody>
    </Page>
  )
}
