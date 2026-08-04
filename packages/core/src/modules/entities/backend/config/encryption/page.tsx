import { Page, PageBody } from '@helios/ui/backend/Page'
import { EncryptionManager } from '../../../components/EncryptionManager'

export default function EncryptionSettingsPage() {
  return (
    <Page>
      <PageBody className="space-y-8">
        <EncryptionManager />
      </PageBody>
    </Page>
  )
}
