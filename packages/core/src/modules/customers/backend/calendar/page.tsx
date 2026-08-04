import { Page, PageBody } from '@helios/ui/backend/Page'
import { getModules } from '@helios/shared/lib/modules/registry'
import { CalendarScreen } from '../../components/calendar/CalendarScreen'

export default function CustomersCalendarPage() {
  // Optional-module flags resolved server-side: the editor offers resource
  // assignment / staff lookups only when those modules are loaded (#3552).
  const moduleIds = new Set(getModules().map((module) => module.id))
  return (
    <Page>
      <PageBody>
        <CalendarScreen
          resourcesEnabled={moduleIds.has('resources')}
          staffEnabled={moduleIds.has('staff')}
        />
      </PageBody>
    </Page>
  )
}
