'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@helios/ui/backend/CrudForm'
import { createCrud } from '@helios/ui/backend/utils/crud'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useT } from '@helios/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@helios/shared/lib/frontend/useOrganizationScope'

export default function CreateAllocationPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const defaultInvoiceId = searchParams.get('invoiceId') || ''
  const defaultPaymentId = searchParams.get('paymentId') || ''
  const initialValues = React.useMemo(() => ({
      isActive: true,
      invoiceId: defaultInvoiceId || undefined,
      paymentId: defaultPaymentId || undefined,
    }), [defaultInvoiceId, defaultPaymentId])

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basic',
        column: 1,
        title: t('commercial.form.group.details'),
        fields: [
          {
            id: 'invoiceId',
            type: 'text',
            label: t('commercial.allocations.form.field.invoiceId'),
            required: true,
            defaultValue: defaultInvoiceId,
            readOnly: Boolean(defaultInvoiceId),
          },
          {
            id: 'paymentId',
            type: 'text',
            label: t('commercial.allocations.form.field.paymentId'),
            required: true,
            defaultValue: defaultPaymentId,
            readOnly: Boolean(defaultPaymentId),
          },
          {
            id: 'allocatedAmount',
            type: 'text',
            label: t('commercial.allocations.form.field.allocatedAmount'),
          },
          {
            id: 'allocatedOn',
            type: 'text',
            label: t('commercial.allocations.form.field.allocatedOn'),
            helpText: t('commercial.allocations.form.field.dateHelp'),
          },
          {
            id: 'isActive',
            type: 'checkbox',
            label: t('commercial.form.field.isActive'),
            defaultValue: true,
          },
        ],
      },
    ],
    [defaultInvoiceId, defaultPaymentId, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('commercial.allocations.create.title')}
          backHref="/backend/commercial/allocations"
          fields={[]}
          groups={groups}
          initialValues={initialValues}
          submitLabel={t('commercial.form.action.create')}
          cancelHref="/backend/commercial/allocations"
          onSubmit={async (values) => {
            await createCrud('commercial/allocations', {
              organizationId,
              tenantId,
              invoiceId: String(values.invoiceId || '').trim(),
              paymentId: String(values.paymentId || '').trim(),
              allocatedAmount: values.allocatedAmount ? String(values.allocatedAmount).trim() : null,
              allocatedOn: values.allocatedOn ? String(values.allocatedOn).trim() : null,
              isActive: values.isActive !== false,
            })
            flash(t('commercial.allocations.flash.created'), 'success')
            router.push('/backend/commercial/allocations')
          }}
        />
      </PageBody>
    </Page>
  )
}
