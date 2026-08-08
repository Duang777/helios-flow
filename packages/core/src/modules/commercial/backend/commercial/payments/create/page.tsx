'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@helios/ui/backend/CrudForm'
import { createCrud } from '@helios/ui/backend/utils/crud'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useT } from '@helios/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@helios/shared/lib/frontend/useOrganizationScope'

export default function CreatePaymentPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const defaultCustomerEntityId = searchParams.get('customerEntityId') || ''
  const initialValues = React.useMemo(() => ({
      status: 'draft',
      currencyCode: 'CNY',
      isActive: true,
      customerEntityId: defaultCustomerEntityId || undefined,
    }), [defaultCustomerEntityId])

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basic',
        column: 1,
        title: t('commercial.form.group.details'),
        fields: [
          {
            id: 'paymentNo',
            type: 'text',
            label: t('commercial.payments.form.field.paymentNo'),
          },
          {
            id: 'status',
            type: 'select',
            label: t('commercial.payments.form.field.status'),
            defaultValue: 'draft',
            options: [
              { value: 'draft', label: t('commercial.paymentStatus.draft') },
              { value: 'posted', label: t('commercial.paymentStatus.posted') },
              { value: 'void', label: t('commercial.paymentStatus.void') },
            ],
          },
          {
            id: 'amount',
            type: 'text',
            label: t('commercial.form.field.amount'),
          },
          {
            id: 'currencyCode',
            type: 'text',
            label: t('commercial.form.field.currencyCode'),
            defaultValue: 'CNY',
          },
          {
            id: 'paidOn',
            type: 'text',
            label: t('commercial.payments.form.field.paidOn'),
            helpText: t('commercial.payments.form.field.dateHelp'),
          },
          {
            id: 'customerEntityId',
            type: 'text',
            label: t('commercial.form.field.customerEntityId'),
            defaultValue: defaultCustomerEntityId,
            readOnly: Boolean(defaultCustomerEntityId),
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
    [defaultCustomerEntityId, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('commercial.payments.create.title')}
          backHref="/backend/commercial/payments"
          fields={[]}
          groups={groups}
          initialValues={initialValues}
          submitLabel={t('commercial.form.action.create')}
          cancelHref="/backend/commercial/payments"
          onSubmit={async (values) => {
            await createCrud('commercial/payments', {
              organizationId,
              tenantId,
              customerEntityId: values.customerEntityId
                ? String(values.customerEntityId).trim()
                : null,
              paymentNo: values.paymentNo ? String(values.paymentNo).trim() : null,
              status: String(values.status || 'draft'),
              amount: values.amount ? String(values.amount).trim() : null,
              currencyCode: values.currencyCode ? String(values.currencyCode).trim() : 'CNY',
              paidOn: values.paidOn ? String(values.paidOn).trim() : null,
              isActive: values.isActive !== false,
            })
            flash(t('commercial.payments.flash.created'), 'success')
            router.push('/backend/commercial/payments')
          }}
        />
      </PageBody>
    </Page>
  )
}
