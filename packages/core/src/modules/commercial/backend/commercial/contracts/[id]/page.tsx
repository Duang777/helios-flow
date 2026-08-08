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

type ContractData = {
  id: string
  name: string
  code: string | null
  status: string
  contractType: string
  amount: string | null
  currencyCode: string | null
  projectId: string | null
  customerEntityId: string | null
  dealId: string | null
  startDate: string | null
  endDate: string | null
  paymentTerms: string | null
  isActive: boolean
  organizationId: string
  tenantId: string
  updatedAt?: string | null
}

type ContractMetrics = {
  actualRevenue: string
  actualCost: string
  projectGrossProfit: string
  invoiceRate: string | null
  collectionRate: string | null
  arOutstanding: string
  overdueOutstanding: string
  allocatedPayment: string
}

type ContractTabId = 'overview' | 'related' | 'metrics'

function resolveTab(raw: string | null): ContractTabId {
  if (raw === 'related' || raw === 'metrics' || raw === 'overview') return raw
  return 'overview'
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

export default function EditContractPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [record, setRecord] = React.useState<ContractData | null>(null)
  const [metrics, setMetrics] = React.useState<ContractMetrics | null>(null)
  const [metricsError, setMetricsError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<ContractTabId>(() =>
    resolveTab(searchParams?.get('tab') ?? null),
  )

  React.useEffect(() => {
    setActiveTab(resolveTab(searchParams?.get('tab') ?? null))
  }, [searchParams])

  React.useEffect(() => {
    async function load() {
      try {
        const response = await apiCall<{ items: ContractData[] }>(
          `/api/commercial/contracts?id=${params?.id}`,
        )
        if (response.ok && response.result && response.result.items.length > 0) {
          setRecord(response.result.items[0])
        } else if (!response.ok) {
          setError(t('commercial.form.errors.load'))
        } else {
          setIsNotFound(true)
        }
      } catch {
        setError(t('commercial.form.errors.load'))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [params?.id, t])

  React.useEffect(() => {
    async function loadMetrics() {
      if (!record?.organizationId || !record.id) return
      setMetricsError(null)
      try {
        const response = await apiCall<ContractMetrics>(
          `/api/commercial/metrics?organizationId=${record.organizationId}&contractId=${record.id}`,
        )
        if (response.ok && response.result) {
          setMetrics(response.result)
        } else {
          setMetricsError(t('commercial.contracts.metrics.loadFailed'))
        }
      } catch {
        setMetricsError(t('commercial.contracts.metrics.loadFailed'))
      }
    }
    void loadMetrics()
  }, [record?.id, record?.organizationId, t])

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
        title: t('commercial.form.group.details'),
        fields: [
          { id: 'name', type: 'text', label: t('commercial.contracts.form.field.name'), required: true },
          { id: 'code', type: 'text', label: t('commercial.contracts.form.field.code') },
          {
            id: 'status',
            type: 'select',
            label: t('commercial.contracts.form.field.status'),
            options: [
              { value: 'draft', label: t('commercial.contractStatus.draft') },
              { value: 'active', label: t('commercial.contractStatus.active') },
              { value: 'completed', label: t('commercial.contractStatus.completed') },
              { value: 'cancelled', label: t('commercial.contractStatus.cancelled') },
            ],
          },
          {
            id: 'contractType',
            type: 'select',
            label: t('commercial.contracts.form.field.contractType'),
            options: [
              { value: 'sales', label: t('commercial.contractType.sales') },
              { value: 'service', label: t('commercial.contractType.service') },
              { value: 'other', label: t('commercial.contractType.other') },
            ],
          },
          { id: 'amount', type: 'text', label: t('commercial.contracts.form.field.amount') },
          { id: 'currencyCode', type: 'text', label: t('commercial.form.field.currencyCode') },
          { id: 'paymentTerms', type: 'text', label: t('commercial.contracts.form.field.paymentTerms') },
          { id: 'isActive', type: 'checkbox', label: t('commercial.form.field.isActive') },
        ],
      },
      {
        id: 'links',
        column: 2,
        title: t('commercial.form.group.links'),
        fields: [
          { id: 'projectId', type: 'text', label: t('commercial.form.field.projectId') },
          { id: 'customerEntityId', type: 'text', label: t('commercial.form.field.customerEntityId') },
          { id: 'dealId', type: 'text', label: t('commercial.form.field.dealId') },
        ],
      },
      {
        id: 'dates',
        column: 2,
        title: t('commercial.form.group.dates'),
        fields: [
          { id: 'startDate', type: 'text', label: t('commercial.contracts.form.field.startDate') },
          { id: 'endDate', type: 'text', label: t('commercial.contracts.form.field.endDate') },
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
            <div className="text-muted-foreground">{t('commercial.form.loading')}</div>
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
            label={t('commercial.form.errors.notFound')}
            backHref="/backend/commercial/contracts"
            backLabel={t('commercial.contracts.page.title')}
          />
        </PageBody>
      </Page>
    )
  }

  if (error || !record) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('commercial.form.errors.notFound')} />
        </PageBody>
      </Page>
    )
  }

  const relatedLinks = [
    {
      href: `/backend/commercial/revenues?contractId=${record.id}`,
      label: t('commercial.contracts.related.revenues'),
    },
    {
      href: `/backend/commercial/costs?contractId=${record.id}`,
      label: t('commercial.contracts.related.costs'),
    },
    {
      href: `/backend/commercial/invoices?contractId=${record.id}`,
      label: t('commercial.contracts.related.invoices'),
    },
    {
      href: `/backend/commercial/allocations?contractId=${record.id}`,
      label: t('commercial.contracts.related.allocations'),
    },
    ...(record.projectId
      ? [
          {
            href: `/backend/projects/${record.projectId}`,
            label: t('commercial.contracts.related.project'),
          },
        ]
      : []),
  ]

  return (
    <Page>
      <PageBody>
        {ConfirmDialogElement}
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{record.name}</h1>
            <Badge variant="outline">{record.status}</Badge>
            {record.code ? (
              <span className="text-sm text-muted-foreground">{record.code}</span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{t('commercial.boundary.notGl')}</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} variant="underline">
          <TabsList>
            <TabsTrigger value="overview">{t('commercial.contracts.tabs.overview')}</TabsTrigger>
            <TabsTrigger value="related">{t('commercial.contracts.tabs.related')}</TabsTrigger>
            <TabsTrigger value="metrics">{t('commercial.contracts.tabs.metrics')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <CrudForm
              title={t('commercial.contracts.edit.title')}
              backHref="/backend/commercial/contracts"
              fields={[]}
              groups={groups}
              initialValues={{ ...record, updatedAt: record.updatedAt }}
              submitLabel={t('commercial.form.action.save')}
              cancelHref="/backend/commercial/contracts"
              onDelete={async () => {
                const confirmed = await confirmDialog({
                  title: t('commercial.contracts.confirm.deleteTitle'),
                  description: t('commercial.contracts.confirm.deleteBody'),
                  variant: 'destructive',
                })
                if (!confirmed) return
                try {
                  await deleteCrud('commercial/contracts', record.id)
                  flash(t('commercial.contracts.flash.deleted'), 'success')
                  router.push('/backend/commercial/contracts')
                } catch (err) {
                  if (surfaceRecordConflict(err, t)) return
                  flash(t('commercial.contracts.flash.deleteFailed'), 'error')
                }
              }}
              onSubmit={async (values) => {
                try {
                  await updateCrud('commercial/contracts', {
                    id: record.id,
                    name: String(values.name || '').trim(),
                    code: values.code ? String(values.code).trim() : null,
                    status: String(values.status || 'draft'),
                    contractType: String(values.contractType || 'sales'),
                    amount: values.amount ? String(values.amount).trim() : null,
                    currencyCode: values.currencyCode ? String(values.currencyCode).trim() : 'CNY',
                    projectId: values.projectId ? String(values.projectId).trim() : null,
                    customerEntityId: values.customerEntityId
                      ? String(values.customerEntityId).trim()
                      : null,
                    dealId: values.dealId ? String(values.dealId).trim() : null,
                    startDate: values.startDate ? String(values.startDate).trim() : null,
                    endDate: values.endDate ? String(values.endDate).trim() : null,
                    paymentTerms: values.paymentTerms ? String(values.paymentTerms).trim() : null,
                    isActive: values.isActive !== false,
                  })
                  flash(t('commercial.contracts.flash.updated'), 'success')
                  const response = await apiCall<{ items: ContractData[] }>(
                    `/api/commercial/contracts?id=${record.id}`,
                  )
                  if (response.ok && response.result?.items?.[0]) {
                    setRecord(response.result.items[0])
                  }
                } catch (err) {
                  if (surfaceRecordConflict(err, t)) return
                  throw err
                }
              }}
            />
          </TabsContent>

          <TabsContent value="related" className="mt-6">
            <ul className="space-y-3 rounded-lg border border-border p-4">
              {relatedLinks.map((item) => (
                <li key={item.href}>
                  <Link className="text-primary hover:underline" href={item.href}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="metrics" className="mt-6 space-y-4">
            {metricsError ? <ErrorMessage label={metricsError} /> : null}
            {!metrics && !metricsError ? (
              <div className="text-sm text-muted-foreground">{t('commercial.form.loading')}</div>
            ) : null}
            {metrics ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label={t('commercial.contracts.metrics.actualRevenue')}
                  value={metrics.actualRevenue}
                />
                <MetricCard
                  label={t('commercial.contracts.metrics.actualCost')}
                  value={metrics.actualCost}
                />
                <MetricCard
                  label={t('commercial.contracts.metrics.grossProfit')}
                  value={metrics.projectGrossProfit}
                />
                <MetricCard
                  label={t('commercial.contracts.metrics.invoiceRate')}
                  value={metrics.invoiceRate ?? '—'}
                />
                <MetricCard
                  label={t('commercial.contracts.metrics.collectionRate')}
                  value={metrics.collectionRate ?? '—'}
                />
                <MetricCard
                  label={t('commercial.contracts.metrics.allocatedPayment')}
                  value={metrics.allocatedPayment}
                />
                <MetricCard
                  label={t('commercial.contracts.metrics.arOutstanding')}
                  value={metrics.arOutstanding}
                />
                <MetricCard
                  label={t('commercial.contracts.metrics.overdueOutstanding')}
                  value={metrics.overdueOutstanding}
                />
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </PageBody>
    </Page>
  )
}
