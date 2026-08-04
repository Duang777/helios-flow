import { Page, PageBody } from '@helios/ui/backend/Page'
import { AiAssistantSettingsPageClient } from '../../../../components/AiAssistantSettingsPageClient'

export default async function AiAssistantLegacySettingsPage() {
  return (
    <Page>
      <PageBody>
        <AiAssistantSettingsPageClient launchMode="legacy" showVisibilityControl />
      </PageBody>
    </Page>
  )
}
