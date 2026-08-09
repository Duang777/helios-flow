'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@helios/ui/backend/CrudForm'
import { createCrud } from '@helios/ui/backend/utils/crud'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useT } from '@helios/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@helios/shared/lib/frontend/useOrganizationScope'

function readParam(params: URLSearchParams | null, key: string): string {
  const value = params?.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

type ProjectCreateInitialValues = {
  name?: string
  code?: string
  dealId?: string
  customerEntityId?: string
  status: string
  budgetRevenue?: string
  budgetCost?: string
  forecastRevenue?: string
  forecastCost?: string
  isActive: boolean
}

export default function CreateProjectPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId, tenantId } = useOrganizationScopeDetail()

  const prefill = React.useMemo<ProjectCreateInitialValues>(() => {
    const dealId = readParam(searchParams, 'dealId')
    const customerEntityId = readParam(searchParams, 'customerEntityId')
    const name = readParam(searchParams, 'name')
    return {
      name: name || undefined,
      code: undefined,
      dealId: dealId || undefined,
      customerEntityId: customerEntityId || undefined,
      status: 'draft',
      budgetRevenue: undefined,
      budgetCost: undefined,
      forecastRevenue: undefined,
      forecastCost: undefined,
      isActive: true,
    }
  }, [searchParams])

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basic',
        column: 1,
        title: t('projects.form.group.details'),
        fields: [
          {
            id: 'name',
            type: 'text',
            label: t('projects.form.field.name'),
            required: true,
          },
          {
            id: 'code',
            type: 'text',
            label: t('projects.form.field.code'),
          },
          {
            id: 'status',
            type: 'select',
            label: t('projects.form.field.status'),
            defaultValue: 'draft',
            options: [
              { value: 'draft', label: t('projects.status.draft') },
              { value: 'active', label: t('projects.status.active') },
              { value: 'on_hold', label: t('projects.status.on_hold') },
              { value: 'completed', label: t('projects.status.completed') },
              { value: 'cancelled', label: t('projects.status.cancelled') },
            ],
          },
          {
            id: 'customerEntityId',
            type: 'text',
            label: t('projects.form.field.customerEntityId'),
            helpText: t('projects.form.field.customerEntityIdHelp'),
            readOnly: Boolean(prefill.customerEntityId),
          },
          {
            id: 'dealId',
            type: 'text',
            label: t('projects.form.field.dealId'),
            helpText: t('projects.form.field.dealIdHelp'),
            readOnly: Boolean(prefill.dealId),
          },
        ],
      },
      {
        id: 'finance',
        column: 2,
        title: t('projects.form.group.budget'),
        fields: [
          {
            id: 'budgetRevenue',
            type: 'text',
            label: t('projects.form.field.budgetRevenue'),
          },
          {
            id: 'budgetCost',
            type: 'text',
            label: t('projects.form.field.budgetCost'),
          },
          {
            id: 'forecastRevenue',
            type: 'text',
            label: t('projects.form.field.forecastRevenue'),
          },
          {
            id: 'forecastCost',
            type: 'text',
            label: t('projects.form.field.forecastCost'),
          },
          {
            id: 'isActive',
            type: 'checkbox',
            label: t('projects.form.field.isActive'),
            defaultValue: true,
          },
        ],
      },
    ],
    [prefill.customerEntityId, prefill.dealId, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('projects.create.title')}
          backHref="/backend/projects"
          fields={[]}
          groups={groups}
          initialValues={prefill}
          submitLabel={t('projects.form.action.create')}
          cancelHref="/backend/projects"
          onSubmit={async (values) => {
            const payload = {
              organizationId,
              tenantId,
              name: String(values.name || '').trim(),
              code: values.code ? String(values.code).trim() : null,
              status: String(values.status || 'draft'),
              customerEntityId: values.customerEntityId
                ? String(values.customerEntityId).trim()
                : null,
              dealId: values.dealId ? String(values.dealId).trim() : null,
              budgetRevenue: values.budgetRevenue ? String(values.budgetRevenue).trim() : null,
              budgetCost: values.budgetCost ? String(values.budgetCost).trim() : null,
              forecastRevenue: values.forecastRevenue
                ? String(values.forecastRevenue).trim()
                : null,
              forecastCost: values.forecastCost ? String(values.forecastCost).trim() : null,
              isActive: values.isActive !== false,
            }
            const created = await createCrud<{ id?: string }>('projects/projects', payload)
            flash(t('projects.flash.created'), 'success')
            const id = created.result && typeof created.result.id === 'string' ? created.result.id : null
            router.push(id ? `/backend/projects/${id}` : '/backend/projects')
          }}
        />
      </PageBody>
    </Page>
  )
}
