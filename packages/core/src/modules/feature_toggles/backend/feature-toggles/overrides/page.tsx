"use client"

import { Page, PageBody } from "@helios/ui/backend/Page";
import { ContextHelp } from "@helios/ui/backend/ContextHelp";
import { useT } from "@helios/shared/lib/i18n/context";
import OverridesTable from "../../../components/OverridesTable";

export default function FeatureToggleOverridesPage() {
  const t = useT()

  return (
    <Page>
      <PageBody>
        <OverridesTable />
      </PageBody>
    </Page>
  )
}

