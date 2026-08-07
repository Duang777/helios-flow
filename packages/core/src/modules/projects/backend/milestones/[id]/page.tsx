'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@helios/ui/backend/CrudForm'
import { updateCrud } from '@helios/ui/backend/utils/crud'
import { flash } from '@helios/ui/backend/FlashMessages'
import { apiCall } from '@helios/ui/backend/utils/apiCall'
import { surfaceRecordConflict } from '@helios/ui/backend/conflicts'
import { useT } from '@helios/shared/lib/i18n/context'
import { RecordNotFoundState, ErrorMessage } from '@helios/ui/backend/detail'

type MilestoneData = {
  id: string
  projectId: string
  name: string
  status: string
  plannedDate: string | null
  actualDate: string | null
  isDelayed?: boolean
  updatedAt?: string | null
}

export default function EditMilestonePage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const [row, setRow] = React.useState<MilestoneData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      try {
        const response = await apiCall<{ items: MilestoneData[] }>(`/api/projects/milestones?id=${params?.id}`)
        if (response.ok && response.result && response.result.items.length > 0) {
          setRow(response.result.items[0])
        } else if (!response.ok) {
          setError(t('projects.milestones.form.errors.load'))
        } else {
          setIsNotFound(true)
        }
      } catch {
        setError(t('projects.milestones.form.errors.load'))
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
        title: t('projects.milestones.form.group.details'),
        fields: [
          { id: 'projectId', type: 'text', label: t('projects.milestones.form.field.projectId'), required: true },
          { id: 'name', type: 'text', label: t('projects.milestones.form.field.name'), required: true },
          {
            id: 'status',
            type: 'select',
            label: t('projects.milestones.form.field.status'),
            options: [
              { value: 'planned', label: t('projects.milestoneStatus.planned') },
              { value: 'in_progress', label: t('projects.milestoneStatus.in_progress') },
              { value: 'done', label: t('projects.milestoneStatus.done') },
              { value: 'cancelled', label: t('projects.milestoneStatus.cancelled') },
            ],
          },
          { id: 'plannedDate', type: 'text', label: t('projects.milestones.form.field.plannedDate') },
          { id: 'actualDate', type: 'text', label: t('projects.milestones.form.field.actualDate') },
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
            label={t('projects.milestones.form.errors.notFound')}
            backHref="/backend/milestones"
            backLabel={t('projects.milestones.page.title')}
          />
        </PageBody>
      </Page>
    )
  }
  if (error || !row) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('projects.milestones.form.errors.notFound')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('projects.milestones.edit.title')}
          backHref="/backend/milestones"
          fields={[]}
          groups={groups}
          initialValues={{ ...row, updatedAt: row.updatedAt }}
          submitLabel={t('projects.form.action.save')}
          cancelHref="/backend/milestones"
          onSubmit={async (values) => {
            try {
              await updateCrud('projects/milestones', {
                id: row.id,
                projectId: String(values.projectId || '').trim(),
                name: String(values.name || '').trim(),
                status: String(values.status || 'planned'),
                plannedDate: values.plannedDate ? String(values.plannedDate).trim() : null,
                actualDate: values.actualDate ? String(values.actualDate).trim() : null,
              })
              flash(t('projects.milestones.flash.updated'), 'success')
              router.push(`/backend/milestones?projectId=${encodeURIComponent(row.projectId)}`)
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
