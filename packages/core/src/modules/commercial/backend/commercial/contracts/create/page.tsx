'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@helios/ui/backend/CrudForm'
import { createCrud } from '@helios/ui/backend/utils/crud'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useT } from '@helios/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@helios/shared/lib/frontend/useOrganizationScope'

function readParam(params: URLSearchParams | null, key: string): string {
  const value = params?.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export default function CreateContractPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId, tenantId } = useOrganizationScopeDetail()

  const prefill = React.useMemo(() => {
    const projectId = readParam(searchParams, 'projectId')
    const customerEntityId = readParam(searchParams, 'customerEntityId')
    const dealId = readParam(searchParams, 'dealId')
    return {
      projectId: projectId || undefined,
      customerEntityId: customerEntityId || undefined,
      dealId: dealId || undefined,
      status: 'draft',
      contractType: 'sales',
      currencyCode: 'CNY',
      isActive: true,
    }
  }, [searchParams])

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basic',
        column: 1,
        title: t('commercial.form.group.details'),
        fields: [
          {
            id: 'name',
            type: 'text',
            label: t('commercial.contracts.form.field.name'),
            required: true,
          },
          {
            id: 'code',
            type: 'text',
            label: t('commercial.contracts.form.field.code'),
          },
          {
            id: 'status',
            type: 'select',
            label: t('commercial.contracts.form.field.status'),
            defaultValue: 'draft',
            options: [
              { value: 'draft', label: t('commercial.contractStatus.draft') },
              { value: 'active', label: t('commercial.contractStatus.active') },
              { value: 'completed', label: t('commercial.contractStatus.completed') },
              { value: 'cancelled', label: t('commercial.contractStatus.cancelled') },
            ],
          },
          {
            id: 'contractType',
            type: 'select',
            label: t('commercial.contracts.form.field.contractType'),
            defaultValue: 'sales',
            options: [
              { value: 'sales', label: t('commercial.contractType.sales') },
              { value: 'service', label: t('commercial.contractType.service') },
              { value: 'other', label: t('commercial.contractType.other') },
            ],
          },
          {
            id: 'amount',
            type: 'text',
            label: t('commercial.contracts.form.field.amount'),
          },
          {
            id: 'currencyCode',
            type: 'text',
            label: t('commercial.form.field.currencyCode'),
            defaultValue: 'CNY',
          },
          {
            id: 'paymentTerms',
            type: 'text',
            label: t('commercial.contracts.form.field.paymentTerms'),
          },
          {
            id: 'isActive',
            type: 'checkbox',
            label: t('commercial.form.field.isActive'),
            defaultValue: true,
          },
        ],
      },
      {
        id: 'links',
        column: 2,
        title: t('commercial.form.group.links'),
        fields: [
          {
            id: 'projectId',
            type: 'text',
            label: t('commercial.form.field.projectId'),
            helpText: t('commercial.form.field.projectIdHelp'),
            readOnly: Boolean(prefill.projectId),
          },
          {
            id: 'customerEntityId',
            type: 'text',
            label: t('commercial.form.field.customerEntityId'),
            helpText: t('commercial.form.field.customerEntityIdHelp'),
            readOnly: Boolean(prefill.customerEntityId),
          },
          {
            id: 'dealId',
            type: 'text',
            label: t('commercial.form.field.dealId'),
            helpText: t('commercial.form.field.dealIdHelp'),
            readOnly: Boolean(prefill.dealId),
          },
        ],
      },
      {
        id: 'dates',
        column: 2,
        title: t('commercial.form.group.dates'),
        fields: [
          {
            id: 'startDate',
            type: 'text',
            label: t('commercial.contracts.form.field.startDate'),
          },
          {
            id: 'endDate',
            type: 'text',
            label: t('commercial.contracts.form.field.endDate'),
          },
        ],
      },
    ],
    [prefill.customerEntityId, prefill.dealId, prefill.projectId, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('commercial.contracts.create.title')}
          backHref="/backend/commercial/contracts"
          fields={[]}
          groups={groups}
          initialValues={prefill}
          submitLabel={t('commercial.form.action.create')}
          cancelHref="/backend/commercial/contracts"
          onSubmit={async (values) => {
            const payload = {
              organizationId,
              tenantId,
              name: String(values.name || '').trim(),
              code: values.code ? String(values.code).trim() : null,
              status: String(values.status || 'draft'),
              contractType: String(values.contractType || 'sales'),
              amount: values.amount ? String(values.amount).trim() : null,
              currencyCode: values.currencyCode ? String(values.currencyCode).trim() : 'CNY',
              projectId: values.projectId ? String(values.projectId).trim() : null,
              customerEntityId: values.customerEntityId
                ? String(values.customerEntityId).trim()
                : null,
              dealId: values.dealId ? String(values.dealId).trim() : null,
              startDate: values.startDate ? String(values.startDate).trim() : null,
              endDate: values.endDate ? String(values.endDate).trim() : null,
              paymentTerms: values.paymentTerms ? String(values.paymentTerms).trim() : null,
              isActive: values.isActive !== false,
            }
            const created = await createCrud<{ id?: string }>('commercial/contracts', payload)
            flash(t('commercial.contracts.flash.created'), 'success')
            const id = created.result && typeof created.result.id === 'string' ? created.result.id : null
            router.push(id ? `/backend/commercial/contracts/${id}` : '/backend/commercial/contracts')
          }}
        />
      </PageBody>
    </Page>
  )
}
