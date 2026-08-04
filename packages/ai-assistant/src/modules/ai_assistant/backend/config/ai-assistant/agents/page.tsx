import { Page, PageBody } from '@helios/ui/backend/Page'
import { AiAgentSettingsPageClient } from './AiAgentSettingsPageClient'

export default async function AiAssistantAgentSettingsPage() {
  return (
    <Page>
      <PageBody>
        <AiAgentSettingsPageClient />
      </PageBody>
    </Page>
  )
}
