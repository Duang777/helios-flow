"use client"
import { Page, PageBody } from "@helios/ui/backend/Page";
import * as React from 'react'
import { useFeatureToggleItem } from "@helios/core/modules/feature_toggles/components/hooks/useFeatureToggleItem";
import { FeatureToggleDetailsCard } from "@helios/core/modules/feature_toggles/components/FeatureToggleDetailsCard";
import { FeatureToggleOverrideCard } from "@helios/core/modules/feature_toggles/components/FeatureToggleOverrideCard";

export default function FeatureToggleDetailsPage({ params }: { params?: { id?: string } }) {
  const id = params?.id ?? ''
  const { data: featureToggleItem } = useFeatureToggleItem(id)

  return (
    <Page>
      <PageBody>
        <FeatureToggleDetailsCard featureToggleItem={featureToggleItem ?? undefined} />
        {id && <FeatureToggleOverrideCard toggleId={id} />}
      </PageBody>
    </Page>
  )
}

