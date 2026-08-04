import { Page, PageBody } from '@helios/ui/backend/Page'
import { InjectionSpot } from '@helios/ui/backend/injection/InjectionSpot'
import SystemStatusPanel from '../../../components/SystemStatusPanel'

export default function SystemStatusPage() {
  return (
    <Page>
      <PageBody>
        <SystemStatusPanel />
        <InjectionSpot
          spotId="configs.system_status:details"
          context={{ path: '/backend/config/system-status' }}
        />
      </PageBody>
    </Page>
  )
}
