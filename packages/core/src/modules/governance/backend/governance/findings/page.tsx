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
import { Input } from '@helios/ui/primitives/input'
import { Label } from '@helios/ui/primitives/label'
import { Play } from 'lucide-react'
import { useT } from '@helios/shared/lib/i18n/context'
import { apiCall, withScopedApiRequestHeaders } from '@helios/ui/backend/utils/apiCall'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useOrganizationScopeDetail, useOrganizationScopeVersion } from '@helios/shared/lib/frontend/useOrganizationScope'
import { useConfirmDialog } from '@helios/ui/backend/confirm-dialog'
import { useGuardedMutation } from '@helios/ui/backend/injection/useGuardedMutation'

type FindingRow = {
  id: string
  ruleId: string
  severity: string
  status: string
  title: string
  subjectType: string
  subjectId: string
  asOf: string
  detectedAt: string | null
}

type ResponsePayload = {
  items: FindingRow[]
  total: number
  page: number
  totalPages: number
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function FindingsPage() {
  const t = useT()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<FindingRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [asOf, setAsOf] = React.useState(todayUtcDate())
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const scopeVersion = useOrganizationScopeVersion()
  const mutationContextId = 'governance-findings-run:mutation'
  const { runMutation } = useGuardedMutation({
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
        const call = await apiCall<ResponsePayload>(`/api/governance/findings?${params.toString()}`, undefined, {
          fallback,
        })
        if (!call.ok) {
          flash(t('governance.findings.list.error.load'), 'error')
          return
        }
        const payload = call.result ?? fallback
        if (!cancelled) {
          setRows(Array.isArray(payload.items) ? payload.items : [])
          setTotal(payload.total || 0)
          setTotalPages(payload.totalPages || 1)
        }
      } catch {
        if (!cancelled) flash(t('governance.findings.list.error.load'), 'error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [page, search, reloadToken, scopeVersion, t])

  const handleRunRules = React.useCallback(async () => {
    const confirmed = await confirmDialog({
      title: t('governance.findings.confirm.runTitle'),
      description: t('governance.findings.confirm.runBody'),
    })
    if (!confirmed) return

    try {
      const result = await runMutation({
        operation: async () => {
          const call = await withScopedApiRequestHeaders(() =>
            apiCall<{
              created?: number
              updated?: number
            }>('/api/governance/rules/run', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ organizationId, tenantId, asOf }),
            }),
          )
          if (!call.ok) {
            throw Object.assign(new Error('[internal] governance.rules.run failed'), {
              status: call.status,
              ...((call.result as Record<string, unknown> | null) ?? {}),
            })
          }
          return call
        },
        context: {
          formId: mutationContextId,
          resourceKind: 'governance.rules',
          resourceId: organizationId,
          retryLastMutation: async () => false,
        },
        mutationPayload: { asOf },
      })
      const summary = (result?.result ?? {}) as { created?: number; updated?: number }
      flash(
        t('governance.findings.flash.rulesRun', {
          created: String(summary.created ?? 0),
          updated: String(summary.updated ?? 0),
        }),
        'success',
      )
      setReloadToken((token) => token + 1)
    } catch {
      flash(t('governance.findings.flash.rulesRunFailed'), 'error')
    }
  }, [asOf, confirmDialog, mutationContextId, organizationId, runMutation, t, tenantId])

  const columns = React.useMemo<ColumnDef<FindingRow>[]>(
    () => [
      {
        accessorKey: 'title',
        header: t('governance.findings.table.title'),
        cell: ({ row }) => (
          <Link
            className="font-medium text-primary hover:underline"
            href={`/backend/governance/findings/${row.original.id}`}
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: 'ruleId',
        header: t('governance.findings.table.ruleId'),
      },
      {
        accessorKey: 'severity',
        header: t('governance.findings.table.severity'),
        cell: ({ row }) => <Badge variant="outline">{row.original.severity}</Badge>,
      },
      {
        accessorKey: 'status',
        header: t('governance.findings.table.status'),
        cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
      },
      {
        id: 'subject',
        header: t('governance.findings.table.subject'),
        cell: ({ row }) => `${row.original.subjectType}:${row.original.subjectId.slice(0, 8)}…`,
      },
      {
        accessorKey: 'asOf',
        header: t('governance.findings.table.asOf'),
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('governance.findings.page.title')}
          columns={columns}
          data={rows}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('governance.findings.list.searchPlaceholder')}
          actions={
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="governance-as-of">{t('governance.findings.dialog.asOf')}</Label>
                <Input
                  id="governance-as-of"
                  type="date"
                  value={asOf}
                  onChange={(event) => setAsOf(event.target.value)}
                  className="w-40"
                />
              </div>
              <Button variant="outline" asChild>
                <Link href="/backend/governance/identity-maps">{t('governance.findings.actions.linkMaps')}</Link>
              </Button>
              <Button onClick={() => void handleRunRules()}>
                <Play className="mr-2 h-4 w-4" />
                {t('governance.actions.runRules')}
              </Button>
            </div>
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'view',
                  label: t('governance.actions.edit'),
                  href: `/backend/governance/findings/${row.id}`,
                },
              ]}
            />
          )}
          emptyState={
            <ListEmptyState entityName={t('governance.findings.page.title')} onAction={() => void handleRunRules()} actionLabel={t('governance.actions.runRules')} />
          }
          pagination={{ page, pageSize: 50, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
          perspective={{ tableId: 'governance.findings.list' }}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
