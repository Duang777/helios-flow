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

type RiskData = {
  id: string
  projectId: string
  title: string
  description: string | null
  riskType: string
  status: string
  ownerEmployeeId: string | null
  organizationId: string
  tenantId: string
  updatedAt?: string | null
}

export default function EditRiskPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const [row, setRow] = React.useState<RiskData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      try {
        const response = await apiCall<{ items: RiskData[] }>(`/api/projects/risks?id=${params?.id}`)
        if (response.ok && response.result && response.result.items.length > 0) {
          setRow(response.result.items[0])
        } else if (!response.ok) {
          setError(t('projects.risks.form.errors.load'))
        } else {
          setIsNotFound(true)
        }
      } catch {
        setError(t('projects.risks.form.errors.load'))
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
        title: t('projects.risks.form.group.details'),
        fields: [
          { id: 'projectId', type: 'text', label: t('projects.risks.form.field.projectId'), required: true },
          { id: 'title', type: 'text', label: t('projects.risks.form.field.title'), required: true },
          { id: 'description', type: 'textarea', label: t('projects.risks.form.field.description') },
          {
            id: 'riskType',
            type: 'select',
            label: t('projects.risks.form.field.riskType'),
            options: [
              { value: 'schedule', label: t('projects.riskType.schedule') },
              { value: 'cost', label: t('projects.riskType.cost') },
              { value: 'scope', label: t('projects.riskType.scope') },
              { value: 'other', label: t('projects.riskType.other') },
            ],
          },
          {
            id: 'status',
            type: 'select',
            label: t('projects.risks.form.field.status'),
            options: [
              { value: 'open', label: t('projects.riskStatus.open') },
              { value: 'mitigating', label: t('projects.riskStatus.mitigating') },
              { value: 'closed', label: t('projects.riskStatus.closed') },
            ],
          },
          { id: 'ownerEmployeeId', type: 'text', label: t('projects.risks.form.field.ownerEmployeeId') },
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
            label={t('projects.risks.form.errors.notFound')}
            backHref="/backend/risks"
            backLabel={t('projects.risks.page.title')}
          />
        </PageBody>
      </Page>
    )
  }
  if (error || !row) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('projects.risks.form.errors.notFound')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('projects.risks.edit.title')}
          backHref="/backend/risks"
          entityId="projects.risk"
          fields={[]}
          groups={groups}
          initialValues={{ ...row, updatedAt: row.updatedAt }}
          submitLabel={t('projects.form.action.save')}
          cancelHref="/backend/risks"
          onSubmit={async (values) => {
            try {
              await updateCrud('projects/risks', {
                id: row.id,
                projectId: String(values.projectId || '').trim(),
                title: String(values.title || '').trim(),
                description: values.description ? String(values.description).trim() : null,
                riskType: String(values.riskType || 'other'),
                status: String(values.status || 'open'),
                ownerEmployeeId: values.ownerEmployeeId ? String(values.ownerEmployeeId).trim() : null,
              })
              flash(t('projects.risks.flash.updated'), 'success')
              router.push(`/backend/risks?projectId=${encodeURIComponent(row.projectId)}`)
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
