import { Page, PageBody } from '@helios/ui/backend/Page'
import { MessagesInboxPageClient } from '../components/MessagesInboxPageClient'

export default function MessagesInboxPage() {
  return (
    <Page>
      <PageBody>
        <MessagesInboxPageClient />
      </PageBody>
    </Page>
  )
}
