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

type InvoiceData = {
  id: string
  contractId: string | null
  projectId: string | null
  customerEntityId: string | null
  invoiceNo: string | null
  status: string
  amount: string | null
  currencyCode: string | null
  issuedOn: string | null
  dueDate: string | null
  isActive: boolean
  updatedAt?: string | null
}

export default function EditInvoicePage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [record, setRecord] = React.useState<InvoiceData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      try {
        const response = await apiCall<{ items: InvoiceData[] }>(
          `/api/commercial/invoices?id=${params?.id}`,
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
          { id: 'invoiceNo', type: 'text', label: t('commercial.invoices.form.field.invoiceNo') },
          {
            id: 'status',
            type: 'select',
            label: t('commercial.invoices.form.field.status'),
            options: [
              { value: 'draft', label: t('commercial.invoiceStatus.draft') },
              { value: 'issued', label: t('commercial.invoiceStatus.issued') },
              { value: 'void', label: t('commercial.invoiceStatus.void') },
            ],
          },
          { id: 'amount', type: 'text', label: t('commercial.form.field.amount') },
          { id: 'currencyCode', type: 'text', label: t('commercial.form.field.currencyCode') },
          { id: 'issuedOn', type: 'text', label: t('commercial.invoices.form.field.issuedOn') },
          { id: 'dueDate', type: 'text', label: t('commercial.invoices.form.field.dueDate') },
          { id: 'contractId', type: 'text', label: t('commercial.form.field.contractId') },
          { id: 'projectId', type: 'text', label: t('commercial.form.field.projectId') },
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
            backHref="/backend/commercial/invoices"
            backLabel={t('commercial.invoices.page.title')}
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
          title={t('commercial.invoices.edit.title')}
          backHref="/backend/commercial/invoices"
          fields={[]}
          groups={groups}
          initialValues={{ ...record, updatedAt: record.updatedAt }}
          submitLabel={t('commercial.form.action.save')}
          cancelHref="/backend/commercial/invoices"
          onDelete={async () => {
            const confirmed = await confirmDialog({
              title: t('commercial.invoices.confirm.deleteTitle'),
              description: t('commercial.invoices.confirm.deleteBody'),
              variant: 'destructive',
            })
            if (!confirmed) return
            try {
              await deleteCrud('commercial/invoices', record.id)
              flash(t('commercial.invoices.flash.deleted'), 'success')
              router.push('/backend/commercial/invoices')
            } catch (err) {
              if (surfaceRecordConflict(err, t)) return
              flash(t('commercial.invoices.flash.deleteFailed'), 'error')
            }
          }}
          onSubmit={async (values) => {
            try {
              await updateCrud('commercial/invoices', {
                id: record.id,
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
              flash(t('commercial.invoices.flash.updated'), 'success')
              const response = await apiCall<{ items: InvoiceData[] }>(
                `/api/commercial/invoices?id=${record.id}`,
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
