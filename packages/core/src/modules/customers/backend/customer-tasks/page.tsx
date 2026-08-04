import { Page, PageBody } from '@helios/ui/backend/Page'
import { CustomerTodosTable } from '../../components/CustomerTodosTable'

export default function CustomerTasksPage() {
  return (
    <Page>
      <PageBody>
        <CustomerTodosTable />
      </PageBody>
    </Page>
  )
}
