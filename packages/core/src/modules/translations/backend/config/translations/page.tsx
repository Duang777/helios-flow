import { Page, PageBody } from '@helios/ui/backend/Page'
import { TranslationManager, LocaleManager } from '../../../components/TranslationManager'

export default function TranslationSettingsPage() {
  return (
    <Page>
      <PageBody className="space-y-8">
        <LocaleManager />
        <TranslationManager mode="standalone" />
      </PageBody>
    </Page>
  )
}
