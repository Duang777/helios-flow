import { Page, PageBody } from '@helios/ui/backend/Page'
import { SearchSettingsPageClient } from '../../../frontend/components/SearchSettingsPageClient'

export default async function SearchSettingsPage() {
  return (
    <Page>
      <PageBody>
        <SearchSettingsPageClient />
      </PageBody>
    </Page>
  )
}
