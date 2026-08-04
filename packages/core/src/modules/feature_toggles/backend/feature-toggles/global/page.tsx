"use client"
import { Page, PageBody } from "@helios/ui/backend/Page";
import { FeatureTogglesTable } from "../../../components/FeatureTogglesTable";
import { ContextHelp } from "@helios/ui/backend/ContextHelp";
import { useT } from "@helios/shared/lib/i18n/context";

export default function FeatureTogglesPage() {
  const t = useT()
  return (
    <Page>
      <PageBody>
        <FeatureTogglesTable />
      </PageBody>
    </Page>
  )
}
