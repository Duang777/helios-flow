import { Page, PageBody } from '@helios/ui/backend/Page'
import { ComposeMessagePageClient } from '../../../components/ComposeMessagePageClient'

export default function ComposeMessagePage() {
  return (
    <Page>
      <PageBody>
        <ComposeMessagePageClient />
      </PageBody>
    </Page>
  )
}
