'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@helios/ui/backend/CrudForm'
import { createCrud } from '@helios/ui/backend/utils/crud'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useT } from '@helios/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@helios/shared/lib/frontend/useOrganizationScope'

const METRIC_OPTIONS = ['revenue', 'gross_profit', 'gross_margin', 'collection'] as const

export default function CreateKpiTargetPage() {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()

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
            defaultValue: 'revenue',
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
            defaultValue: 'amount',
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
            defaultValue: 'year',
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
            defaultValue: 'CNY',
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
          title={t('insights.kpiTargets.create.title')}
          backHref="/backend/insights/kpi-targets"
          fields={[]}
          groups={groups}
          initialValues={{
            metricKey: 'revenue',
            unit: 'amount',
            periodType: 'year',
            periodKey: String(new Date().getFullYear()),
            targetValue: '',
            currencyCode: 'CNY',
            note: '',
            isActive: true,
          }}
          submitLabel={t('insights.form.action.create')}
          cancelHref="/backend/insights/kpi-targets"
          onSubmit={async (values) => {
            const unit = String(values.unit || 'amount')
            const payload = {
              organizationId,
              tenantId,
              metricKey: String(values.metricKey || 'revenue'),
              unit,
              periodType: String(values.periodType || 'year'),
              periodKey: String(values.periodKey || '').trim(),
              targetValue: String(values.targetValue || '').trim(),
              currencyCode: unit === 'amount' ? String(values.currencyCode || 'CNY').trim() : null,
              note: values.note ? String(values.note).trim() : null,
              isActive: values.isActive !== false,
            }
            const created = await createCrud<{ id?: string }>('insights/kpi-targets', payload)
            flash(t('insights.kpiTargets.flash.created'), 'success')
            const id = created.result && typeof created.result.id === 'string' ? created.result.id : null
            router.push(id ? `/backend/insights/kpi-targets/${id}` : '/backend/insights/kpi-targets')
          }}
        />
      </PageBody>
    </Page>
  )
}
