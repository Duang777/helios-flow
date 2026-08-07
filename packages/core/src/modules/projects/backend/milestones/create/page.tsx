'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@helios/ui/backend/CrudForm'
import { createCrud } from '@helios/ui/backend/utils/crud'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useT } from '@helios/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@helios/shared/lib/frontend/useOrganizationScope'

export default function CreateMilestonePage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultProjectId = searchParams.get('projectId') || ''
  const { organizationId, tenantId } = useOrganizationScopeDetail()

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basic',
        column: 1,
        title: t('projects.milestones.form.group.details'),
        fields: [
          {
            id: 'projectId',
            type: 'text',
            label: t('projects.milestones.form.field.projectId'),
            required: true,
            defaultValue: defaultProjectId,
          },
          {
            id: 'name',
            type: 'text',
            label: t('projects.milestones.form.field.name'),
            required: true,
          },
          {
            id: 'status',
            type: 'select',
            label: t('projects.milestones.form.field.status'),
            defaultValue: 'planned',
            options: [
              { value: 'planned', label: t('projects.milestoneStatus.planned') },
              { value: 'in_progress', label: t('projects.milestoneStatus.in_progress') },
              { value: 'done', label: t('projects.milestoneStatus.done') },
              { value: 'cancelled', label: t('projects.milestoneStatus.cancelled') },
            ],
          },
          {
            id: 'plannedDate',
            type: 'text',
            label: t('projects.milestones.form.field.plannedDate'),
            helpText: t('projects.milestones.form.field.dateHelp'),
          },
          {
            id: 'actualDate',
            type: 'text',
            label: t('projects.milestones.form.field.actualDate'),
          },
        ],
      },
    ],
    [defaultProjectId, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('projects.milestones.create.title')}
          backHref="/backend/milestones"
          fields={[]}
          groups={groups}
          submitLabel={t('projects.form.action.create')}
          cancelHref="/backend/milestones"
          onSubmit={async (values) => {
            await createCrud('projects/milestones', {
              organizationId,
              tenantId,
              projectId: String(values.projectId || '').trim(),
              name: String(values.name || '').trim(),
              status: String(values.status || 'planned'),
              plannedDate: values.plannedDate ? String(values.plannedDate).trim() : null,
              actualDate: values.actualDate ? String(values.actualDate).trim() : null,
            })
            flash(t('projects.milestones.flash.created'), 'success')
            router.push(
              values.projectId
                ? `/backend/milestones?projectId=${encodeURIComponent(String(values.projectId))}`
                : '/backend/milestones',
            )
          }}
        />
      </PageBody>
    </Page>
  )
}
