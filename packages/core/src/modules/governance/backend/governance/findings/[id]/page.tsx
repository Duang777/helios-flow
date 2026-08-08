'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@helios/ui/backend/CrudForm'
import { updateCrud } from '@helios/ui/backend/utils/crud'
import { flash } from '@helios/ui/backend/FlashMessages'
import { apiCall } from '@helios/ui/backend/utils/apiCall'
import { surfaceRecordConflict } from '@helios/ui/backend/conflicts'
import { useT } from '@helios/shared/lib/i18n/context'
import { RecordNotFoundState, ErrorMessage } from '@helios/ui/backend/detail'
import { Badge } from '@helios/ui/primitives/badge'
import { Button } from '@helios/ui/primitives/button'

const STATUS_OPTIONS = ['open', 'acknowledged', 'resolved', 'dismissed'] as const
const SEVERITY_OPTIONS = ['info', 'warning', 'critical'] as const

type EvidenceItem = { type: string; id: string; module: string }

type FindingData = {
  id: string
  ruleId: string
  severity: string
  status: string
  title: string
  reason: string
  evidenceIds: EvidenceItem[]
  subjectType: string
  subjectId: string
  impactSummary: string | null
  ownerRole: string | null
  suggestedDueOn: string | null
  payload: Record<string, unknown> | null
  detectedAt: string | null
  asOf: string
  isSimulation: boolean
  organizationId: string
  tenantId: string
  updatedAt?: string | null
}

function evidenceHref(item: EvidenceItem): string | null {
  if (item.module === 'projects' && item.type === 'project') {
    return `/backend/projects/projects/${item.id}`
  }
  if (item.module === 'projects' && item.type === 'milestone') {
    return `/backend/projects/milestones/${item.id}`
  }
  if (item.module === 'commercial' && item.type === 'invoice') {
    return `/backend/commercial/invoices/${item.id}`
  }
  if (item.module === 'customers' && item.type === 'deal') {
    return `/backend/customers/deals/${item.id}`
  }
  return null
}

export default function FindingDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const [record, setRecord] = React.useState<FindingData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      try {
        const response = await apiCall<{ items: FindingData[] }>(`/api/governance/findings?id=${params?.id}`)
        if (response.ok && response.result && response.result.items.length > 0) {
          setRecord(response.result.items[0])
        } else if (!response.ok) {
          setError(t('governance.form.errors.load'))
        } else {
          setIsNotFound(true)
        }
      } catch {
        setError(t('governance.form.errors.load'))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [params?.id, t])

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'disposition',
        column: 1,
        title: t('governance.form.group.details'),
        fields: [
          {
            id: 'status',
            type: 'select',
            label: t('governance.findings.form.field.status'),
            options: STATUS_OPTIONS.map((value) => ({ value, label: value })),
          },
          {
            id: 'severity',
            type: 'select',
            label: t('governance.findings.form.field.severity'),
            options: SEVERITY_OPTIONS.map((value) => ({ value, label: value })),
          },
          {
            id: 'ownerRole',
            type: 'text',
            label: t('governance.findings.form.field.ownerRole'),
          },
          {
            id: 'impactSummary',
            type: 'textarea',
            label: t('governance.findings.form.field.impactSummary'),
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
          <RecordNotFoundState message={t('governance.form.errors.notFound')} />
        </PageBody>
      </Page>
    )
  }
  if (error || !record) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage message={error ?? t('governance.form.errors.load')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody className="space-y-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{record.title}</h2>
            <Badge variant="outline">{record.ruleId}</Badge>
            <Badge variant="secondary">{record.status}</Badge>
            {record.isSimulation ? <Badge variant="outline">simulation</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {record.subjectType} · {record.asOf}
          </p>
        </div>

        <section className="space-y-2 rounded-lg border border-border p-4">
          <h3 className="font-medium">{t('governance.findings.detail.reason')}</h3>
          <p className="text-sm">{record.reason}</p>
          {record.impactSummary ? (
            <>
              <h3 className="font-medium">{t('governance.findings.detail.impact')}</h3>
              <p className="text-sm">{record.impactSummary}</p>
            </>
          ) : null}
        </section>

        <section className="space-y-2 rounded-lg border border-border p-4">
          <h3 className="font-medium">{t('governance.findings.detail.evidence')}</h3>
          {record.evidenceIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('governance.findings.detail.noEvidence')}</p>
          ) : (
            <ul className="space-y-2">
              {record.evidenceIds.map((item) => {
                const href = evidenceHref(item)
                return (
                  <li key={`${item.module}:${item.type}:${item.id}`} className="text-sm">
                    {href ? (
                      <Link className="text-primary hover:underline" href={href}>
                        {item.module}/{item.type}/{item.id}
                      </Link>
                    ) : (
                      <span>
                        {item.module}/{item.type}/{item.id}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {record.payload ? (
          <section className="space-y-2 rounded-lg border border-border p-4">
            <h3 className="font-medium">{t('governance.findings.detail.payload')}</h3>
            <pre className="overflow-x-auto text-xs">{JSON.stringify(record.payload, null, 2)}</pre>
          </section>
        ) : null}

        <CrudForm
          title={t('governance.findings.detail.title')}
          groups={groups}
          initialValues={{
            status: record.status,
            severity: record.severity,
            ownerRole: record.ownerRole ?? '',
            impactSummary: record.impactSummary ?? '',
          }}
          submitLabel={t('governance.form.action.save')}
          onSubmit={async (values) => {
            try {
              await updateCrud('/api/governance/findings', {
                id: record.id,
                organizationId: record.organizationId,
                tenantId: record.tenantId,
                status: values.status,
                severity: values.severity,
                ownerRole: values.ownerRole ? String(values.ownerRole).trim() : null,
                impactSummary: values.impactSummary ? String(values.impactSummary).trim() : null,
              })
              flash(t('governance.findings.flash.acknowledged'), 'success')
              router.refresh()
            } catch (err) {
              if (surfaceRecordConflict(err, t)) return
              throw err
            }
          }}
        />

        <Button variant="outline" asChild>
          <Link href="/backend/governance/findings">{t('governance.findings.page.title')}</Link>
        </Button>
      </PageBody>
    </Page>
  )
}
