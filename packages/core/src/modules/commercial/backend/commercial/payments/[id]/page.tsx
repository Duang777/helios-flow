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

type PaymentData = {
  id: string
  customerEntityId: string | null
  paymentNo: string | null
  status: string
  amount: string | null
  currencyCode: string | null
  paidOn: string | null
  isActive: boolean
  organizationId: string
  tenantId: string
  updatedAt?: string | null
}

export default function EditPaymentPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [record, setRecord] = React.useState<PaymentData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      try {
        const response = await apiCall<{ items: PaymentData[] }>(
          `/api/commercial/payments?id=${params?.id}`,
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
          { id: 'paymentNo', type: 'text', label: t('commercial.payments.form.field.paymentNo') },
          {
            id: 'status',
            type: 'select',
            label: t('commercial.payments.form.field.status'),
            options: [
              { value: 'draft', label: t('commercial.paymentStatus.draft') },
              { value: 'posted', label: t('commercial.paymentStatus.posted') },
              { value: 'void', label: t('commercial.paymentStatus.void') },
            ],
          },
          { id: 'amount', type: 'text', label: t('commercial.form.field.amount') },
          { id: 'currencyCode', type: 'text', label: t('commercial.form.field.currencyCode') },
          { id: 'paidOn', type: 'text', label: t('commercial.payments.form.field.paidOn') },
          { id: 'customerEntityId', type: 'text', label: t('commercial.form.field.customerEntityId') },
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
            backHref="/backend/commercial/payments"
            backLabel={t('commercial.payments.page.title')}
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
          title={t('commercial.payments.edit.title')}
          backHref="/backend/commercial/payments"
          entityId="commercial.payment"
          fields={[]}
          groups={groups}
          initialValues={{ ...record, updatedAt: record.updatedAt }}
          submitLabel={t('commercial.form.action.save')}
          cancelHref="/backend/commercial/payments"
          onDelete={async () => {
            const confirmed = await confirmDialog({
              title: t('commercial.payments.confirm.deleteTitle'),
              description: t('commercial.payments.confirm.deleteBody'),
              variant: 'destructive',
            })
            if (!confirmed) return
            try {
              await deleteCrud('commercial/payments', record.id)
              flash(t('commercial.payments.flash.deleted'), 'success')
              router.push('/backend/commercial/payments')
            } catch (err) {
              if (surfaceRecordConflict(err, t)) return
              flash(t('commercial.payments.flash.deleteFailed'), 'error')
            }
          }}
          onSubmit={async (values) => {
            try {
              await updateCrud('commercial/payments', {
                id: record.id,
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
              flash(t('commercial.payments.flash.updated'), 'success')
              const response = await apiCall<{ items: PaymentData[] }>(
                `/api/commercial/payments?id=${record.id}`,
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
