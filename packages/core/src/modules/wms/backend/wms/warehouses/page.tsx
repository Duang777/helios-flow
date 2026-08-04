import { Page, PageBody } from '@helios/ui/backend/Page'
import { WarehouseSection } from '../../../components/backend/WmsConfigurationPage'

export default function WmsWarehousesPage() {
  return (
    <Page>
      <PageBody>
        <WarehouseSection />
      </PageBody>
    </Page>
  )
}
