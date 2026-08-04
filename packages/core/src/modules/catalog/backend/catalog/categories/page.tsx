"use client"

import { Page, PageBody } from '@helios/ui/backend/Page'
import CategoriesDataTable from '../../../components/categories/CategoriesDataTable'

export default function CatalogCategoriesPage() {
  return (
    <Page>
      <PageBody>
        <CategoriesDataTable />
      </PageBody>
    </Page>
  )
}
