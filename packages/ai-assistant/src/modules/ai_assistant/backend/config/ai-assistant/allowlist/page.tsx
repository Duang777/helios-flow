import { Page, PageBody } from '@helios/ui/backend/Page'
import { AiTenantAllowlistPageClient } from './AiTenantAllowlistPageClient'

export default async function AiAssistantAllowlistPage() {
  return (
    <Page>
      <PageBody>
        <AiTenantAllowlistPageClient />
      </PageBody>
    </Page>
  )
}
