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

type AllocationData = {
  id: string
  invoiceId: string
  paymentId: string
  allocatedAmount: string | null
  allocatedOn: string | null
  isActive: boolean
  organizationId: string
  tenantId: string
  updatedAt?: string | null
}

export default function EditAllocationPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [record, setRecord] = React.useState<AllocationData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      try {
        const response = await apiCall<{ items: AllocationData[] }>(
          `/api/commercial/allocations?id=${params?.id}`,
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
          { id: 'invoiceId', type: 'text', label: t('commercial.allocations.form.field.invoiceId'), required: true },
          { id: 'paymentId', type: 'text', label: t('commercial.allocations.form.field.paymentId'), required: true },
          { id: 'allocatedAmount', type: 'text', label: t('commercial.allocations.form.field.allocatedAmount') },
          { id: 'allocatedOn', type: 'text', label: t('commercial.allocations.form.field.allocatedOn') },
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
            backHref="/backend/commercial/allocations"
            backLabel={t('commercial.allocations.page.title')}
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
          title={t('commercial.allocations.edit.title')}
          backHref="/backend/commercial/allocations"
          entityId="commercial.payment_allocation"
          fields={[]}
          groups={groups}
          initialValues={{ ...record, updatedAt: record.updatedAt }}
          submitLabel={t('commercial.form.action.save')}
          cancelHref="/backend/commercial/allocations"
          onDelete={async () => {
            const confirmed = await confirmDialog({
              title: t('commercial.allocations.confirm.deleteTitle'),
              description: t('commercial.allocations.confirm.deleteBody'),
              variant: 'destructive',
            })
            if (!confirmed) return
            try {
              await deleteCrud('commercial/allocations', record.id)
              flash(t('commercial.allocations.flash.deleted'), 'success')
              router.push('/backend/commercial/allocations')
            } catch (err) {
              if (surfaceRecordConflict(err, t)) return
              flash(t('commercial.allocations.flash.deleteFailed'), 'error')
            }
          }}
          onSubmit={async (values) => {
            try {
              await updateCrud('commercial/allocations', {
                id: record.id,
                invoiceId: String(values.invoiceId || '').trim(),
                paymentId: String(values.paymentId || '').trim(),
                allocatedAmount: values.allocatedAmount ? String(values.allocatedAmount).trim() : null,
                allocatedOn: values.allocatedOn ? String(values.allocatedOn).trim() : null,
                isActive: values.isActive !== false,
              })
              flash(t('commercial.allocations.flash.updated'), 'success')
              const response = await apiCall<{ items: AllocationData[] }>(
                `/api/commercial/allocations?id=${record.id}`,
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
