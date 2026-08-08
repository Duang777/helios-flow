'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@helios/ui/backend/CrudForm'
import { updateCrud, deleteCrud } from '@helios/ui/backend/utils/crud'
import { flash } from '@helios/ui/backend/FlashMessages'
import { apiCall } from '@helios/ui/backend/utils/apiCall'
import { surfaceRecordConflict } from '@helios/ui/backend/conflicts'
import { useT } from '@helios/shared/lib/i18n/context'
import { useConfirmDialog } from '@helios/ui/backend/confirm-dialog'
import { RecordNotFoundState, ErrorMessage } from '@helios/ui/backend/detail'

const STATUS_OPTIONS = ['active', 'retired'] as const

type IdentityMapData = {
  id: string
  sourceEntityId: string
  sourceCustomerCode: string | null
  canonicalEntityId: string
  canonicalCustomerCode: string | null
  rationale: string
  status: string
  isSimulation: boolean
  isActive: boolean
  organizationId: string
  tenantId: string
  updatedAt?: string | null
}

export default function EditIdentityMapPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [record, setRecord] = React.useState<IdentityMapData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      try {
        const response = await apiCall<{ items: IdentityMapData[] }>(
          `/api/governance/identity-maps?id=${params?.id}`,
        )
        if (response.ok && response.result && response.result.items.length > 0) {
          setRecord(response.result.items[0])
        } else if (!response.ok) {
          setError(t('governance.form.errors.load'))
        } else {
          setIsNotFound(true)
        }
      } catch {
        setError(t('governance.form.errors.load'))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [params?.id, t])

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
            options: STATUS_OPTIONS.map((value) => ({ value, label: value })),
          },
          {
            id: 'isSimulation',
            type: 'checkbox',
            label: t('governance.identityMaps.form.field.isSimulation'),
          },
          {
            id: 'isActive',
            type: 'checkbox',
            label: t('governance.form.field.isActive'),
          },
        ],
      },
    ],
    [t],
  )

  if (loading) return null
  if (isNotFound) {
    return (
      <Page>
        <PageBody>
          <RecordNotFoundState
            label={t('governance.form.errors.notFound')}
            backHref="/backend/governance/identity-maps"
            backLabel={t('governance.identityMaps.page.title')}
          />
        </PageBody>
      </Page>
    )
  }
  if (error || !record) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('governance.form.errors.load')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('governance.identityMaps.edit.title')}
          fields={[]}
          groups={groups}
          initialValues={record}
          submitLabel={t('governance.form.action.save')}
          onSubmit={async (values) => {
            try {
              await updateCrud('governance/identity-maps', {
                ...values,
                id: record.id,
                organizationId: record.organizationId,
                tenantId: record.tenantId,
                sourceCustomerCode: values.sourceCustomerCode ? String(values.sourceCustomerCode).trim() : null,
                canonicalCustomerCode: values.canonicalCustomerCode
                  ? String(values.canonicalCustomerCode).trim()
                  : null,
              })
              flash(t('governance.identityMaps.flash.updated'), 'success')
              router.push('/backend/governance/identity-maps')
            } catch (err) {
              if (surfaceRecordConflict(err, t)) return
              throw err
            }
          }}
          onDelete={async () => {
            const confirmed = await confirmDialog({
              title: t('governance.identityMaps.confirm.deleteTitle'),
              description: t('governance.identityMaps.confirm.deleteBody'),
              variant: 'destructive',
            })
            if (!confirmed) return
            await deleteCrud('governance/identity-maps', record.id)
            flash(t('governance.identityMaps.flash.deleted'), 'success')
            router.push('/backend/governance/identity-maps')
          }}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
