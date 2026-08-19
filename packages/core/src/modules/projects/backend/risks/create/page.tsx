'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@helios/ui/backend/CrudForm'
import { createCrud } from '@helios/ui/backend/utils/crud'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useT } from '@helios/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@helios/shared/lib/frontend/useOrganizationScope'

export default function CreateRiskPage() {
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
        title: t('projects.risks.form.group.details'),
        fields: [
          {
            id: 'projectId',
            type: 'text',
            label: t('projects.risks.form.field.projectId'),
            required: true,
            defaultValue: defaultProjectId,
          },
          { id: 'title', type: 'text', label: t('projects.risks.form.field.title'), required: true },
          { id: 'description', type: 'textarea', label: t('projects.risks.form.field.description') },
          {
            id: 'riskType',
            type: 'select',
            label: t('projects.risks.form.field.riskType'),
            defaultValue: 'other',
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
            defaultValue: 'open',
            options: [
              { value: 'open', label: t('projects.riskStatus.open') },
              { value: 'mitigating', label: t('projects.riskStatus.mitigating') },
              { value: 'closed', label: t('projects.riskStatus.closed') },
            ],
          },
          {
            id: 'ownerEmployeeId',
            type: 'text',
            label: t('projects.risks.form.field.ownerEmployeeId'),
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
          title={t('projects.risks.create.title')}
          backHref="/backend/risks"
          fields={[]}
          groups={groups}
          submitLabel={t('projects.form.action.create')}
          cancelHref="/backend/risks"
          onSubmit={async (values) => {
            await createCrud('projects/risks', {
              organizationId,
              tenantId,
              projectId: String(values.projectId || '').trim(),
              title: String(values.title || '').trim(),
              description: values.description ? String(values.description).trim() : null,
              riskType: String(values.riskType || 'other'),
              status: String(values.status || 'open'),
              ownerEmployeeId: values.ownerEmployeeId ? String(values.ownerEmployeeId).trim() : null,
            })
            flash(t('projects.risks.flash.created'), 'success')
            router.push(
              values.projectId
                ? `/backend/risks?projectId=${encodeURIComponent(String(values.projectId))}`
                : '/backend/risks',
            )
          }}
        />
      </PageBody>
    </Page>
  )
}
