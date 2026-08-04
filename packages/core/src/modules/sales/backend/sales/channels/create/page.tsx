"use client"

import * as React from 'react'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { useRouter } from 'next/navigation'
import { CrudForm } from '@helios/ui/backend/CrudForm'
import { createCrud } from '@helios/ui/backend/utils/crud'
import { collectCustomFieldValues } from '@helios/ui/backend/utils/customFieldValues'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useT } from '@helios/shared/lib/i18n/context'
import { useChannelFields, buildChannelPayload, type ChannelFormValues } from '@helios/core/modules/sales/components/channels/channelFormFields'
import { useSalesChannelsEnabled } from '@helios/core/modules/sales/components/useSalesChannelsEnabled'
import { SalesChannelsDisabledNotice } from '@helios/core/modules/sales/components/SalesChannelsDisabledNotice'
import { E } from '#generated/entities.ids.generated'

export default function CreateChannelPage() {
  const t = useT()
  const { fields, groups } = useChannelFields()
  const { enabled: channelsEnabled, isLoading: channelsEnabledLoading } = useSalesChannelsEnabled()
  const router = useRouter()

  if (!channelsEnabled && !channelsEnabledLoading) {
    return <SalesChannelsDisabledNotice />
  }

  return (
    <Page>
      <PageBody>
        <CrudForm<ChannelFormValues>
          title={t('sales.channels.form.createTitle', 'Create sales channel')}
          entityId={E.sales.sales_channel}
          fields={fields}
          groups={[
            ...groups,
            { id: 'custom', title: t('entities.customFields.title', 'Custom Attributes'), column: 2, kind: 'customFields' },
          ]}
          initialValues={{ isActive: true }}
          submitLabel={t('sales.channels.form.createSubmit', 'Create channel')}
          cancelHref="/backend/sales/channels"
          onSubmit={async (values) => {
            const payload = buildChannelPayload(values)
            const customFields = collectCustomFieldValues(values)
            if (Object.keys(customFields).length) {
              payload.customFields = customFields
            }
            await createCrud('sales/channels', payload, {
              errorMessage: t('sales.channels.form.errors.create', 'Failed to create channel.'),
            })
            flash(t('sales.channels.form.messages.created', 'Channel created.'), 'success')
            router.push('/backend/sales/channels')
          }}
        />
      </PageBody>
    </Page>
  )
}
