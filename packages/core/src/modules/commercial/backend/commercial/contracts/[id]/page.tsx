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

type ContractData = {
  id: string
  name: string
  code: string | null
  status: string
  contractType: string
  amount: string | null
  currencyCode: string | null
  projectId: string | null
  customerEntityId: string | null
  dealId: string | null
  startDate: string | null
  endDate: string | null
  paymentTerms: string | null
  isActive: boolean
  organizationId: string
  tenantId: string
  updatedAt?: string | null
}

export default function EditContractPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [record, setRecord] = React.useState<ContractData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      try {
        const response = await apiCall<{ items: ContractData[] }>(
          `/api/commercial/contracts?id=${params?.id}`,
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
          { id: 'name', type: 'text', label: t('commercial.contracts.form.field.name'), required: true },
          { id: 'code', type: 'text', label: t('commercial.contracts.form.field.code') },
          {
            id: 'status',
            type: 'select',
            label: t('commercial.contracts.form.field.status'),
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
            options: [
              { value: 'sales', label: t('commercial.contractType.sales') },
              { value: 'service', label: t('commercial.contractType.service') },
              { value: 'other', label: t('commercial.contractType.other') },
            ],
          },
          { id: 'amount', type: 'text', label: t('commercial.contracts.form.field.amount') },
          { id: 'currencyCode', type: 'text', label: t('commercial.form.field.currencyCode') },
          { id: 'paymentTerms', type: 'text', label: t('commercial.contracts.form.field.paymentTerms') },
          { id: 'isActive', type: 'checkbox', label: t('commercial.form.field.isActive') },
        ],
      },
      {
        id: 'links',
        column: 2,
        title: t('commercial.form.group.links'),
        fields: [
          { id: 'projectId', type: 'text', label: t('commercial.form.field.projectId') },
          { id: 'customerEntityId', type: 'text', label: t('commercial.form.field.customerEntityId') },
          { id: 'dealId', type: 'text', label: t('commercial.form.field.dealId') },
        ],
      },
      {
        id: 'dates',
        column: 2,
        title: t('commercial.form.group.dates'),
        fields: [
          { id: 'startDate', type: 'text', label: t('commercial.contracts.form.field.startDate') },
          { id: 'endDate', type: 'text', label: t('commercial.contracts.form.field.endDate') },
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
            backHref="/backend/commercial/contracts"
            backLabel={t('commercial.contracts.page.title')}
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
          title={t('commercial.contracts.edit.title')}
          backHref="/backend/commercial/contracts"
          fields={[]}
          groups={groups}
          initialValues={{ ...record, updatedAt: record.updatedAt }}
          submitLabel={t('commercial.form.action.save')}
          cancelHref="/backend/commercial/contracts"
          onDelete={async () => {
            const confirmed = await confirmDialog({
              title: t('commercial.contracts.confirm.deleteTitle'),
              description: t('commercial.contracts.confirm.deleteBody'),
              variant: 'destructive',
            })
            if (!confirmed) return
            try {
              await deleteCrud('commercial/contracts', record.id)
              flash(t('commercial.contracts.flash.deleted'), 'success')
              router.push('/backend/commercial/contracts')
            } catch (err) {
              if (surfaceRecordConflict(err, t)) return
              flash(t('commercial.contracts.flash.deleteFailed'), 'error')
            }
          }}
          onSubmit={async (values) => {
            try {
              await updateCrud('commercial/contracts', {
                id: record.id,
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
              })
              flash(t('commercial.contracts.flash.updated'), 'success')
              const response = await apiCall<{ items: ContractData[] }>(
                `/api/commercial/contracts?id=${record.id}`,
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
