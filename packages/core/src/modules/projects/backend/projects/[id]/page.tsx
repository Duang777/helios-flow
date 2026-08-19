'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@helios/ui/backend/CrudForm'
import { updateCrud, deleteCrud } from '@helios/ui/backend/utils/crud'
import { flash } from '@helios/ui/backend/FlashMessages'
import { apiCall } from '@helios/ui/backend/utils/apiCall'
import { surfaceRecordConflict } from '@helios/ui/backend/conflicts'
import { useT } from '@helios/shared/lib/i18n/context'
import { useConfirmDialog } from '@helios/ui/backend/confirm-dialog'
import { RecordNotFoundState, ErrorMessage } from '@helios/ui/backend/detail'
import { Badge } from '@helios/ui/primitives/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@helios/ui/primitives/tabs'
import { InjectionSpot } from '@helios/ui/backend/injection/InjectionSpot'
import {
  ProjectMilestonesPanel,
  ProjectRisksPanel,
} from '../../../components/ProjectChildTable'

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

type ProjectTabId = 'overview' | 'milestones' | 'risks'

function resolveTab(raw: string | null): ProjectTabId {
  if (raw === 'milestones' || raw === 'risks' || raw === 'overview') return raw
  return 'overview'
}

function statusLabel(status: string, t: (key: string) => string): string {
  const key = `projects.status.${status}`
  const translated = t(key)
  return translated === key ? status : translated
}

export default function ProjectDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [project, setProject] = React.useState<ProjectData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<ProjectTabId>(() =>
    resolveTab(searchParams?.get('tab') ?? null),
  )

  React.useEffect(() => {
    setActiveTab(resolveTab(searchParams?.get('tab') ?? null))
  }, [searchParams])

  React.useEffect(() => {
    async function load() {
      try {
        const response = await apiCall<{ items: ProjectData[] }>(
          `/api/projects/projects?id=${params?.id}`,
        )
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

  const handleTabChange = React.useCallback(
    (next: string) => {
      const tab = resolveTab(next)
      setActiveTab(tab)
      const url = new URL(window.location.href)
      if (tab === 'overview') url.searchParams.delete('tab')
      else url.searchParams.set('tab', tab)
      router.replace(`${url.pathname}${url.search}`, { scroll: false })
    },
    [router],
  )

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
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <Badge variant="outline">{statusLabel(project.status, t)}</Badge>
            {project.code ? (
              <span className="text-sm text-muted-foreground">{project.code}</span>
            ) : null}
            <InjectionSpot
              spotId="detail:projects.project:header"
              context={{
                entityType: 'projects.project',
                projectId: project.id,
                organizationId: project.organizationId,
                recordId: project.id,
                data: { project },
              }}
              data={{ project }}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {project.customerEntityId ? (
              <span>
                {t('projects.detail.summary.customer')}:{' '}
                <Link
                  className="text-primary hover:underline"
                  href={`/backend/customers/companies-v2/${project.customerEntityId}`}
                >
                  {project.customerEntityId}
                </Link>
              </span>
            ) : null}
            {project.dealId ? (
              <span>
                {t('projects.detail.summary.deal')}:{' '}
                <Link
                  className="text-primary hover:underline"
                  href={`/backend/customers/deals/${project.dealId}`}
                >
                  {project.dealId}
                </Link>
              </span>
            ) : null}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} variant="underline">
          <TabsList>
            <TabsTrigger value="overview">{t('projects.detail.tabs.overview')}</TabsTrigger>
            <TabsTrigger value="milestones">{t('projects.detail.tabs.milestones')}</TabsTrigger>
            <TabsTrigger value="risks">{t('projects.detail.tabs.risks')}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6">
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
                    customerEntityId: values.customerEntityId
                      ? String(values.customerEntityId).trim()
                      : null,
                    dealId: values.dealId ? String(values.dealId).trim() : null,
                    budgetRevenue: values.budgetRevenue
                      ? String(values.budgetRevenue).trim()
                      : null,
                    budgetCost: values.budgetCost ? String(values.budgetCost).trim() : null,
                    forecastRevenue: values.forecastRevenue
                      ? String(values.forecastRevenue).trim()
                      : null,
                    forecastCost: values.forecastCost
                      ? String(values.forecastCost).trim()
                      : null,
                    isActive: values.isActive !== false,
                  })
                  flash(t('projects.flash.updated'), 'success')
                  const response = await apiCall<{ items: ProjectData[] }>(
                    `/api/projects/projects?id=${project.id}`,
                  )
                  if (response.ok && response.result?.items?.[0]) {
                    setProject(response.result.items[0])
                  }
                } catch (err) {
                  if (surfaceRecordConflict(err, t)) return
                  throw err
                }
              }}
            />
          </TabsContent>
          <TabsContent value="milestones" className="mt-6">
            <ProjectMilestonesPanel projectId={project.id} />
          </TabsContent>
          <TabsContent value="risks" className="mt-6">
            <ProjectRisksPanel projectId={project.id} />
          </TabsContent>
        </Tabs>
      </PageBody>
    </Page>
  )
}
