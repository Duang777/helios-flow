'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@helios/ui/backend/CrudForm'
import { createCrud } from '@helios/ui/backend/utils/crud'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useT } from '@helios/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@helios/shared/lib/frontend/useOrganizationScope'

export default function CreateRevenuePage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const defaultProjectId = searchParams.get('projectId') || ''
  const defaultContractId = searchParams.get('contractId') || ''
  const initialValues = React.useMemo(() => ({
      dataVersion: 'actual',
      currencyCode: 'CNY',
      isActive: true,
      projectId: defaultProjectId || undefined,
      contractId: defaultContractId || undefined,
    }), [defaultProjectId, defaultContractId])

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basic',
        column: 1,
        title: t('commercial.form.group.details'),
        fields: [
          {
            id: 'projectId',
            type: 'text',
            label: t('commercial.form.field.projectId'),
            helpText: t('commercial.form.field.projectIdHelp'),
            required: true,
            defaultValue: defaultProjectId,
            readOnly: Boolean(defaultProjectId),
          },
          {
            id: 'contractId',
            type: 'text',
            label: t('commercial.form.field.contractId'),
            helpText: t('commercial.form.field.contractIdHelp'),
            defaultValue: defaultContractId,
            readOnly: Boolean(defaultContractId),
          },
          {
            id: 'dataVersion',
            type: 'text',
            label: t('commercial.revenues.form.field.dataVersion'),
            defaultValue: 'actual',
            readOnly: true,
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
            id: 'recognizedOn',
            type: 'text',
            label: t('commercial.revenues.form.field.recognizedOn'),
            helpText: t('commercial.revenues.form.field.dateHelp'),
          },
          {
            id: 'note',
            type: 'text',
            label: t('commercial.form.field.note'),
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
    [defaultContractId, defaultProjectId, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('commercial.revenues.create.title')}
          backHref="/backend/commercial/revenues"
          fields={[]}
          groups={groups}
          initialValues={initialValues}
          submitLabel={t('commercial.form.action.create')}
          cancelHref="/backend/commercial/revenues"
          onSubmit={async (formValues) => {
            const values = formValues as Record<string, unknown>
            await createCrud('commercial/revenues', {
              organizationId,
              tenantId,
              projectId: String(values.projectId || '').trim(),
              contractId: values.contractId ? String(values.contractId).trim() : null,
              dataVersion: String(values.dataVersion || 'actual'),
              amount: values.amount ? String(values.amount).trim() : null,
              currencyCode: values.currencyCode ? String(values.currencyCode).trim() : 'CNY',
              recognizedOn: values.recognizedOn ? String(values.recognizedOn).trim() : null,
              note: values.note ? String(values.note).trim() : null,
              isActive: values.isActive !== false,
            })
            flash(t('commercial.revenues.flash.created'), 'success')
            router.push(
              values.projectId
                ? `/backend/commercial/revenues?projectId=${encodeURIComponent(String(values.projectId))}`
                : '/backend/commercial/revenues',
            )
          }}
        />
      </PageBody>
    </Page>
  )
}
