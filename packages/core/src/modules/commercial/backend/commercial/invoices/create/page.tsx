'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@helios/ui/backend/CrudForm'
import { createCrud } from '@helios/ui/backend/utils/crud'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useT } from '@helios/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@helios/shared/lib/frontend/useOrganizationScope'

export default function CreateInvoicePage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const defaultProjectId = searchParams.get('projectId') || ''
  const defaultContractId = searchParams.get('contractId') || ''
  const defaultCustomerEntityId = searchParams.get('customerEntityId') || ''
  const initialValues = React.useMemo(() => ({
      status: 'draft',
      currencyCode: 'CNY',
      isActive: true,
      projectId: defaultProjectId || undefined,
      contractId: defaultContractId || undefined,
      customerEntityId: defaultCustomerEntityId || undefined,
    }), [defaultProjectId, defaultContractId, defaultCustomerEntityId])

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basic',
        column: 1,
        title: t('commercial.form.group.details'),
        fields: [
          {
            id: 'invoiceNo',
            type: 'text',
            label: t('commercial.invoices.form.field.invoiceNo'),
          },
          {
            id: 'status',
            type: 'select',
            label: t('commercial.invoices.form.field.status'),
            defaultValue: 'draft',
            options: [
              { value: 'draft', label: t('commercial.invoiceStatus.draft') },
              { value: 'issued', label: t('commercial.invoiceStatus.issued') },
              { value: 'void', label: t('commercial.invoiceStatus.void') },
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
            id: 'issuedOn',
            type: 'text',
            label: t('commercial.invoices.form.field.issuedOn'),
            helpText: t('commercial.invoices.form.field.dateHelp'),
          },
          {
            id: 'dueDate',
            type: 'text',
            label: t('commercial.invoices.form.field.dueDate'),
          },
          {
            id: 'contractId',
            type: 'text',
            label: t('commercial.form.field.contractId'),
            defaultValue: defaultContractId,
            readOnly: Boolean(defaultContractId),
          },
          {
            id: 'projectId',
            type: 'text',
            label: t('commercial.form.field.projectId'),
            defaultValue: defaultProjectId,
            readOnly: Boolean(defaultProjectId),
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
    [defaultContractId, defaultCustomerEntityId, defaultProjectId, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('commercial.invoices.create.title')}
          backHref="/backend/commercial/invoices"
          fields={[]}
          groups={groups}
          initialValues={initialValues}
          submitLabel={t('commercial.form.action.create')}
          cancelHref="/backend/commercial/invoices"
          onSubmit={async (values) => {
            await createCrud('commercial/invoices', {
              organizationId,
              tenantId,
              contractId: values.contractId ? String(values.contractId).trim() : null,
              projectId: values.projectId ? String(values.projectId).trim() : null,
              customerEntityId: values.customerEntityId
                ? String(values.customerEntityId).trim()
                : null,
              invoiceNo: values.invoiceNo ? String(values.invoiceNo).trim() : null,
              status: String(values.status || 'draft'),
              amount: values.amount ? String(values.amount).trim() : null,
              currencyCode: values.currencyCode ? String(values.currencyCode).trim() : 'CNY',
              issuedOn: values.issuedOn ? String(values.issuedOn).trim() : null,
              dueDate: values.dueDate ? String(values.dueDate).trim() : null,
              isActive: values.isActive !== false,
            })
            flash(t('commercial.invoices.flash.created'), 'success')
            router.push('/backend/commercial/invoices')
          }}
        />
      </PageBody>
    </Page>
  )
}
