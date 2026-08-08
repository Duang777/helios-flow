'use client'

import * as React from 'react'
import Link from 'next/link'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { DataTable } from '@helios/ui/backend/DataTable'
import { ListEmptyState } from '@helios/ui/backend/filters/ListEmptyState'
import type { ColumnDef } from '@tanstack/react-table'
import { RowActions } from '@helios/ui/backend/RowActions'
import { Badge } from '@helios/ui/primitives/badge'
import { Button } from '@helios/ui/primitives/button'
import { Plus } from 'lucide-react'
import { useT } from '@helios/shared/lib/i18n/context'
import { apiCall, withScopedApiRequestHeaders } from '@helios/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@helios/ui/backend/utils/optimisticLock'
import { surfaceRecordConflict } from '@helios/ui/backend/conflicts'
import { useGuardedMutation } from '@helios/ui/backend/injection/useGuardedMutation'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@helios/shared/lib/frontend/useOrganizationScope'
import { useConfirmDialog } from '@helios/ui/backend/confirm-dialog'

type KpiTargetRow = {
  id: string
  metricKey: string
  unit: string
  periodType: string
  periodKey: string
  targetValue: string
  currencyCode: string | null
  organizationId: string
  tenantId: string
  updatedAt: string
}

type ResponsePayload = {
  items: KpiTargetRow[]
  total: number
  page: number
  totalPages: number
}

export default function KpiTargetsPage() {
  const t = useT()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<KpiTargetRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const scopeVersion = useOrganizationScopeVersion()
  const mutationContextId = 'insights-kpi-targets-list:mutation'
  const { runMutation, retryLastMutation } = useGuardedMutation<{
    formId: string
    resourceKind: string
    resourceId: string
    retryLastMutation: () => Promise<boolean>
  }>({
    contextId: mutationContextId,
    blockedMessage: t('ui.forms.flash.saveBlocked', 'Save blocked by validation'),
  })

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('pageSize', '50')
        if (search) params.set('search', search)
        const fallback: ResponsePayload = { items: [], total: 0, page, totalPages: 1 }
        const call = await apiCall<ResponsePayload>(`/api/insights/kpi-targets?${params.toString()}`, undefined, {
          fallback,
        })
        if (!call.ok) {
          flash(t('insights.kpiTargets.list.error.load'), 'error')
          return
        }
        const payload = call.result ?? fallback
        if (!cancelled) {
          setRows(Array.isArray(payload.items) ? payload.items : [])
          setTotal(payload.total || 0)
          setTotalPages(payload.totalPages || 1)
        }
      } catch {
        if (!cancelled) flash(t('insights.kpiTargets.list.error.load'), 'error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [page, search, reloadToken, scopeVersion, t])

  const metricLabel = React.useCallback(
    (key: string) => t(`insights.metric.${key}`, key),
    [t],
  )

  const handleDelete = React.useCallback(
    async (row: KpiTargetRow) => {
      const confirmed = await confirmDialog({
        title: t('insights.kpiTargets.confirm.deleteTitle'),
        description: t('insights.kpiTargets.confirm.deleteBody'),
        variant: 'destructive',
      })
      if (!confirmed) return

      try {
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(buildOptimisticLockHeader(row.updatedAt), () =>
              apiCall(`/api/insights/kpi-targets`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: row.id,
                  organizationId: row.organizationId,
                  tenantId: row.tenantId,
                }),
              }),
            )
            if (!call.ok) {
              throw Object.assign(new Error('[internal] insights.kpi_targets.delete failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: mutationContextId,
            resourceKind: 'insights.kpi_target',
            resourceId: row.id,
            retryLastMutation,
          },
          mutationPayload: { id: row.id },
        })
        flash(t('insights.kpiTargets.flash.deleted'), 'success')
        setReloadToken((token) => token + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((token) => token + 1) })) return
        flash(t('insights.kpiTargets.flash.deleteFailed'), 'error')
      }
    },
    [confirmDialog, mutationContextId, retryLastMutation, runMutation, t],
  )

  const columns = React.useMemo<ColumnDef<KpiTargetRow>[]>(
    () => [
      {
        accessorKey: 'metricKey',
        header: t('insights.kpiTargets.table.metricKey'),
        cell: ({ row }) => (
          <Link
            className="font-medium text-primary hover:underline"
            href={`/backend/insights/kpi-targets/${row.original.id}`}
          >
            {metricLabel(row.original.metricKey)}
          </Link>
        ),
      },
      {
        id: 'period',
        header: t('insights.kpiTargets.table.period'),
        cell: ({ row }) => `${row.original.periodType} / ${row.original.periodKey}`,
      },
      {
        accessorKey: 'targetValue',
        header: t('insights.kpiTargets.table.targetValue'),
        cell: ({ row }) => {
          const suffix = row.original.unit === 'ratio' ? '%' : row.original.currencyCode ? ` ${row.original.currencyCode}` : ''
          return `${row.original.targetValue}${suffix}`
        },
      },
      {
        accessorKey: 'unit',
        header: t('insights.kpiTargets.table.unit'),
        cell: ({ row }) => (
          <Badge variant="outline">
            {row.original.unit === 'ratio' ? t('insights.unit.ratio') : t('insights.unit.amount')}
          </Badge>
        ),
      },
    ],
    [metricLabel, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('insights.kpiTargets.page.title')}
          columns={columns}
          data={rows}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('insights.kpiTargets.list.searchPlaceholder')}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/backend/insights/kpi">{t('insights.kpi.board.title')}</Link>
              </Button>
              <Button asChild>
                <Link href="/backend/insights/kpi-targets/create">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('insights.kpiTargets.actions.create')}
                </Link>
              </Button>
            </div>
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'edit',
                  label: t('insights.actions.edit'),
                  href: `/backend/insights/kpi-targets/${row.id}`,
                },
                {
                  id: 'delete',
                  label: t('insights.actions.delete'),
                  destructive: true,
                  onSelect: () => handleDelete(row),
                },
              ]}
            />
          )}
          emptyState={
            <ListEmptyState
              entityName={t('insights.kpiTargets.page.title')}
              createHref="/backend/insights/kpi-targets/create"
              createLabel={t('insights.kpiTargets.actions.create')}
            />
          }
          pagination={{ page, pageSize: 50, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
          perspective={{ tableId: 'insights.kpi_targets.list' }}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
