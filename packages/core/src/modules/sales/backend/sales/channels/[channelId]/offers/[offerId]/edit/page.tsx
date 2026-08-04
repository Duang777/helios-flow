"use client"

import * as React from 'react'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { ChannelOfferForm } from '@helios/core/modules/sales/components/channels/ChannelOfferForm'

export default function EditChannelOfferPage({ params }: { params?: { channelId?: string; offerId?: string } }) {
  const channelId = params?.channelId ?? ''
  const offerId = params?.offerId ?? ''
  return (
    <Page>
      <PageBody>
        <ChannelOfferForm mode="edit" channelId={channelId} offerId={offerId} />
      </PageBody>
    </Page>
  )
}
