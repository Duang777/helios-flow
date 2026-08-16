'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@helios/ui/backend/CrudForm'
import { createCrud } from '@helios/ui/backend/utils/crud'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useT } from '@helios/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@helios/shared/lib/frontend/useOrganizationScope'

const STATUS_OPTIONS = ['active', 'retired'] as const

export default function CreateIdentityMapPage() {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basic',
        column: 1,
        title: t('governance.form.group.details'),
        fields: [
          {
            id: 'sourceEntityId',
            type: 'text',
            label: t('governance.identityMaps.form.field.sourceEntityId'),
            required: true,
          },
          {
            id: 'sourceCustomerCode',
            type: 'text',
            label: t('governance.identityMaps.form.field.sourceCustomerCode'),
          },
          {
            id: 'canonicalEntityId',
            type: 'text',
            label: t('governance.identityMaps.form.field.canonicalEntityId'),
            required: true,
          },
          {
            id: 'canonicalCustomerCode',
            type: 'text',
            label: t('governance.identityMaps.form.field.canonicalCustomerCode'),
          },
          {
            id: 'rationale',
            type: 'textarea',
            label: t('governance.identityMaps.form.field.rationale'),
            required: true,
          },
          {
            id: 'status',
            type: 'select',
            label: t('governance.identityMaps.form.field.status'),
            defaultValue: 'active',
            options: STATUS_OPTIONS.map((value) => ({ value, label: value })),
          },
          {
            id: 'isSimulation',
            type: 'checkbox',
            label: t('governance.identityMaps.form.field.isSimulation'),
            defaultValue: false,
          },
          {
            id: 'isActive',
            type: 'checkbox',
            label: t('governance.form.field.isActive'),
            defaultValue: true,
          },
        ],
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('governance.identityMaps.create.title')}
          fields={[]}
          groups={groups}
          submitLabel={t('governance.form.action.create')}
          onSubmit={async (values) => {
            await createCrud('governance/identity-maps', {
              ...values,
              organizationId,
              tenantId,
              sourceCustomerCode: values.sourceCustomerCode ? String(values.sourceCustomerCode).trim() : null,
              canonicalCustomerCode: values.canonicalCustomerCode
                ? String(values.canonicalCustomerCode).trim()
                : null,
            })
            flash(t('governance.identityMaps.flash.created'), 'success')
            router.push('/backend/governance/identity-maps')
          }}
        />
      </PageBody>
    </Page>
  )
}
