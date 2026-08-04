import { Page, PageBody } from '@helios/ui/backend/Page'
import CurrencyFetchingConfig from '../../../components/CurrencyFetchingConfig'

export default async function CurrencyFetchingPage() {
  return (
    <Page>
      <PageBody className="space-y-8">
        <CurrencyFetchingConfig />
      </PageBody>
    </Page>
  )
}
