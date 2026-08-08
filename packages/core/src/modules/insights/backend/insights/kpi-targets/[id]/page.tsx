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

const METRIC_OPTIONS = ['revenue', 'gross_profit', 'gross_margin', 'collection'] as const

type KpiTargetData = {
  id: string
  metricKey: string
  unit: string
  periodType: string
  periodKey: string
  targetValue: string
  currencyCode: string | null
  note: string | null
  isActive: boolean
  organizationId: string
  tenantId: string
  updatedAt?: string | null
}

export default function EditKpiTargetPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [record, setRecord] = React.useState<KpiTargetData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      try {
        const response = await apiCall<{ items: KpiTargetData[] }>(
          `/api/insights/kpi-targets?id=${params?.id}`,
        )
        if (response.ok && response.result && response.result.items.length > 0) {
          setRecord(response.result.items[0])
        } else if (!response.ok) {
          setError(t('insights.form.errors.load'))
        } else {
          setIsNotFound(true)
        }
      } catch {
        setError(t('insights.form.errors.load'))
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
        title: t('insights.form.group.details'),
        fields: [
          {
            id: 'metricKey',
            type: 'select',
            label: t('insights.kpiTargets.form.field.metricKey'),
            required: true,
            options: METRIC_OPTIONS.map((value) => ({
              value,
              label: t(`insights.metric.${value}`),
            })),
          },
          {
            id: 'unit',
            type: 'select',
            label: t('insights.kpiTargets.form.field.unit'),
            required: true,
            options: [
              { value: 'amount', label: t('insights.unit.amount') },
              { value: 'ratio', label: t('insights.unit.ratio') },
            ],
          },
          {
            id: 'periodType',
            type: 'select',
            label: t('insights.kpiTargets.form.field.periodType'),
            required: true,
            options: [
              { value: 'year', label: t('insights.period.year') },
              { value: 'quarter', label: t('insights.period.quarter') },
              { value: 'month', label: t('insights.period.month') },
            ],
          },
          {
            id: 'periodKey',
            type: 'text',
            label: t('insights.kpiTargets.form.field.periodKey'),
            helpText: t('insights.kpiTargets.form.field.periodKeyHelp'),
            required: true,
          },
          {
            id: 'targetValue',
            type: 'text',
            label: t('insights.kpiTargets.form.field.targetValue'),
            helpText: t('insights.kpiTargets.form.field.targetValueHelp'),
            required: true,
          },
          {
            id: 'currencyCode',
            type: 'text',
            label: t('insights.kpiTargets.form.field.currencyCode'),
          },
          {
            id: 'note',
            type: 'textarea',
            label: t('insights.form.field.note'),
          },
          {
            id: 'isActive',
            type: 'checkbox',
            label: t('insights.form.field.isActive'),
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
          <RecordNotFoundState backHref="/backend/insights/kpi-targets" />
        </PageBody>
      </Page>
    )
  }
  if (error || !record) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage message={error ?? t('insights.form.errors.notFound')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('insights.kpiTargets.edit.title')}
          backHref="/backend/insights/kpi-targets"
          fields={[]}
          groups={groups}
          initialValues={record}
          submitLabel={t('insights.form.action.save')}
          cancelHref="/backend/insights/kpi-targets"
          onSubmit={async (values) => {
            const unit = String(values.unit || record.unit)
            const payload = {
              id: record.id,
              metricKey: String(values.metricKey || record.metricKey),
              unit,
              periodType: String(values.periodType || record.periodType),
              periodKey: String(values.periodKey || record.periodKey).trim(),
              targetValue: String(values.targetValue || record.targetValue).trim(),
              currencyCode: unit === 'amount' ? String(values.currencyCode || record.currencyCode || 'CNY').trim() : null,
              note: values.note ? String(values.note).trim() : null,
              isActive: values.isActive !== false,
            }
            try {
              await updateCrud('insights/kpi-targets', payload, record.updatedAt ?? undefined)
              flash(t('insights.kpiTargets.flash.updated'), 'success')
              router.refresh()
            } catch (err) {
              if (surfaceRecordConflict(err, t, { onRefresh: () => router.refresh() })) return
              throw err
            }
          }}
          onDelete={async () => {
            const confirmed = await confirmDialog({
              title: t('insights.kpiTargets.confirm.deleteTitle'),
              description: t('insights.kpiTargets.confirm.deleteBody'),
              variant: 'destructive',
            })
            if (!confirmed) return
            try {
              await deleteCrud(
                'insights/kpi-targets',
                { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
                record.updatedAt ?? undefined,
              )
              flash(t('insights.kpiTargets.flash.deleted'), 'success')
              router.push('/backend/insights/kpi-targets')
            } catch (err) {
              if (surfaceRecordConflict(err, t)) return
              flash(t('insights.kpiTargets.flash.deleteFailed'), 'error')
            }
          }}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
