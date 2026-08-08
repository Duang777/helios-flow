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

type CostData = {
  id: string
  projectId: string
  contractId: string | null
  dataVersion: string
  costType: string
  amount: string | null
  currencyCode: string | null
  incurredOn: string | null
  note: string | null
  isActive: boolean
  updatedAt?: string | null
}

export default function EditCostPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [record, setRecord] = React.useState<CostData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      try {
        const response = await apiCall<{ items: CostData[] }>(
          `/api/commercial/costs?id=${params?.id}`,
        )
        if (response.ok && response.result && response.result.items.length > 0) {
          setRecord(response.result.items[0])
        } else if (!response.ok) {
          setError(t('commercial.form.errors.load'))
        } else {
          setIsNotFound(true)
        }
      } catch {
        setError(t('commercial.form.errors.load'))
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
        title: t('commercial.form.group.details'),
        fields: [
          { id: 'projectId', type: 'text', label: t('commercial.form.field.projectId'), required: true },
          { id: 'contractId', type: 'text', label: t('commercial.form.field.contractId') },
          { id: 'dataVersion', type: 'text', label: t('commercial.revenues.form.field.dataVersion'), readOnly: true },
          {
            id: 'costType',
            type: 'select',
            label: t('commercial.costs.form.field.costType'),
            options: [
              { value: 'labor', label: t('commercial.costType.labor') },
              { value: 'purchase', label: t('commercial.costType.purchase') },
              { value: 'outsourcing', label: t('commercial.costType.outsourcing') },
              { value: 'other', label: t('commercial.costType.other') },
            ],
          },
          { id: 'amount', type: 'text', label: t('commercial.form.field.amount') },
          { id: 'currencyCode', type: 'text', label: t('commercial.form.field.currencyCode') },
          { id: 'incurredOn', type: 'text', label: t('commercial.costs.form.field.incurredOn') },
          { id: 'note', type: 'text', label: t('commercial.form.field.note') },
          { id: 'isActive', type: 'checkbox', label: t('commercial.form.field.isActive') },
        ],
      },
    ],
    [t],
  )

  if (loading) {
    return (
      <Page>
        <PageBody>
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">{t('commercial.form.loading')}</div>
          </div>
        </PageBody>
      </Page>
    )
  }

  if (isNotFound) {
    return (
      <Page>
        <PageBody>
          <RecordNotFoundState
            label={t('commercial.form.errors.notFound')}
            backHref="/backend/commercial/costs"
            backLabel={t('commercial.costs.page.title')}
          />
        </PageBody>
      </Page>
    )
  }

  if (error || !record) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('commercial.form.errors.notFound')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        {ConfirmDialogElement}
        <CrudForm
          title={t('commercial.costs.edit.title')}
          backHref="/backend/commercial/costs"
          fields={[]}
          groups={groups}
          initialValues={{ ...record, updatedAt: record.updatedAt }}
          submitLabel={t('commercial.form.action.save')}
          cancelHref="/backend/commercial/costs"
          onDelete={async () => {
            const confirmed = await confirmDialog({
              title: t('commercial.costs.confirm.deleteTitle'),
              description: t('commercial.costs.confirm.deleteBody'),
              variant: 'destructive',
            })
            if (!confirmed) return
            try {
              await deleteCrud('commercial/costs', record.id)
              flash(t('commercial.costs.flash.deleted'), 'success')
              router.push('/backend/commercial/costs')
            } catch (err) {
              if (surfaceRecordConflict(err, t)) return
              flash(t('commercial.costs.flash.deleteFailed'), 'error')
            }
          }}
          onSubmit={async (values) => {
            try {
              await updateCrud('commercial/costs', {
                id: record.id,
                projectId: String(values.projectId || '').trim(),
                contractId: values.contractId ? String(values.contractId).trim() : null,
                dataVersion: String(values.dataVersion || 'actual'),
                costType: String(values.costType || 'other'),
                amount: values.amount ? String(values.amount).trim() : null,
                currencyCode: values.currencyCode ? String(values.currencyCode).trim() : 'CNY',
                incurredOn: values.incurredOn ? String(values.incurredOn).trim() : null,
                note: values.note ? String(values.note).trim() : null,
                isActive: values.isActive !== false,
              })
              flash(t('commercial.costs.flash.updated'), 'success')
              const response = await apiCall<{ items: CostData[] }>(
                `/api/commercial/costs?id=${record.id}`,
              )
              if (response.ok && response.result?.items?.[0]) {
                setRecord(response.result.items[0])
              }
            } catch (err) {
              if (surfaceRecordConflict(err, t)) return
              throw err
            }
          }}
        />
      </PageBody>
    </Page>
  )
}
