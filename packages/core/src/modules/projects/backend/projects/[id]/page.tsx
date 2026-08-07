'use client'

import * as React from 'react'
import Link from 'next/link'
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
import { Button } from '@helios/ui/primitives/button'

type ProjectData = {
  id: string
  name: string
  code: string | null
  status: string
  customerEntityId: string | null
  dealId: string | null
  budgetRevenue: string | null
  budgetCost: string | null
  forecastRevenue: string | null
  forecastCost: string | null
  isActive: boolean
  organizationId: string
  tenantId: string
  updatedAt?: string | null
}

export default function EditProjectPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [project, setProject] = React.useState<ProjectData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      try {
        const response = await apiCall<{ items: ProjectData[] }>(`/api/projects/projects?id=${params?.id}`)
        if (response.ok && response.result && response.result.items.length > 0) {
          setProject(response.result.items[0])
        } else if (!response.ok) {
          setError(t('projects.form.errors.load'))
        } else {
          setIsNotFound(true)
        }
      } catch {
        setError(t('projects.form.errors.load'))
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
        title: t('projects.form.group.details'),
        fields: [
          { id: 'name', type: 'text', label: t('projects.form.field.name'), required: true },
          { id: 'code', type: 'text', label: t('projects.form.field.code') },
          {
            id: 'status',
            type: 'select',
            label: t('projects.form.field.status'),
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
          },
          { id: 'dealId', type: 'text', label: t('projects.form.field.dealId') },
        ],
      },
      {
        id: 'finance',
        column: 2,
        title: t('projects.form.group.budget'),
        fields: [
          { id: 'budgetRevenue', type: 'text', label: t('projects.form.field.budgetRevenue') },
          { id: 'budgetCost', type: 'text', label: t('projects.form.field.budgetCost') },
          { id: 'forecastRevenue', type: 'text', label: t('projects.form.field.forecastRevenue') },
          { id: 'forecastCost', type: 'text', label: t('projects.form.field.forecastCost') },
          { id: 'isActive', type: 'checkbox', label: t('projects.form.field.isActive') },
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
            <div className="text-muted-foreground">{t('projects.form.loading')}</div>
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
            label={t('projects.form.errors.notFound')}
            backHref="/backend/projects"
            backLabel={t('projects.page.title')}
          />
        </PageBody>
      </Page>
    )
  }

  if (error || !project) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('projects.form.errors.notFound')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        {ConfirmDialogElement}
        <div className="mb-4 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/backend/milestones?projectId=${project.id}`}>{t('projects.links.milestones')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/backend/risks?projectId=${project.id}`}>{t('projects.links.risks')}</Link>
          </Button>
        </div>
        <CrudForm
          title={t('projects.edit.title')}
          backHref="/backend/projects"
          fields={[]}
          groups={groups}
          initialValues={{
            ...project,
            updatedAt: project.updatedAt,
          }}
          submitLabel={t('projects.form.action.save')}
          cancelHref="/backend/projects"
          onDelete={async () => {
            const confirmed = await confirmDialog({
              title: t('projects.confirm.deleteTitle'),
              description: t('projects.confirm.deleteBody'),
              variant: 'destructive',
            })
            if (!confirmed) return
            try {
              await deleteCrud('projects/projects', project.id)
              flash(t('projects.flash.deleted'), 'success')
              router.push('/backend/projects')
            } catch (err) {
              if (surfaceRecordConflict(err, t)) return
              flash(t('projects.flash.deleteFailed'), 'error')
            }
          }}
          onSubmit={async (values) => {
            try {
              await updateCrud('projects/projects', {
                id: project.id,
                name: String(values.name || '').trim(),
                code: values.code ? String(values.code).trim() : null,
                status: String(values.status || 'draft'),
                customerEntityId: values.customerEntityId ? String(values.customerEntityId).trim() : null,
                dealId: values.dealId ? String(values.dealId).trim() : null,
                budgetRevenue: values.budgetRevenue ? String(values.budgetRevenue).trim() : null,
                budgetCost: values.budgetCost ? String(values.budgetCost).trim() : null,
                forecastRevenue: values.forecastRevenue ? String(values.forecastRevenue).trim() : null,
                forecastCost: values.forecastCost ? String(values.forecastCost).trim() : null,
                isActive: values.isActive !== false,
              })
              flash(t('projects.flash.updated'), 'success')
              router.push('/backend/projects')
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
