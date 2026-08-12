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

type IdentityMapRow = {
  id: string
  sourceEntityId: string
  canonicalEntityId: string
  rationale: string
  status: string
  organizationId: string
  tenantId: string
  updatedAt: string
}

type ResponsePayload = {
  items: IdentityMapRow[]
  total: number
  page: number
  totalPages: number
}

export default function IdentityMapsPage() {
  const t = useT()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<IdentityMapRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const scopeVersion = useOrganizationScopeVersion()
  const mutationContextId = 'governance-identity-maps-list:mutation'
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
        const call = await apiCall<ResponsePayload>(
          `/api/governance/identity-maps?${params.toString()}`,
          undefined,
          { fallback },
        )
        if (!call.ok) {
          flash(t('governance.identityMaps.list.error.load'), 'error')
          return
        }
        const payload = call.result ?? fallback
        if (!cancelled) {
          setRows(Array.isArray(payload.items) ? payload.items : [])
          setTotal(payload.total || 0)
          setTotalPages(payload.totalPages || 1)
        }
      } catch {
        if (!cancelled) flash(t('governance.identityMaps.list.error.load'), 'error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [page, search, reloadToken, scopeVersion, t])

  const handleDelete = React.useCallback(
    async (row: IdentityMapRow) => {
      const confirmed = await confirmDialog({
        title: t('governance.identityMaps.confirm.deleteTitle'),
        description: t('governance.identityMaps.confirm.deleteBody'),
        variant: 'destructive',
      })
      if (!confirmed) return

      try {
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(buildOptimisticLockHeader(row.updatedAt), () =>
              apiCall(`/api/governance/identity-maps`, {
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
              throw Object.assign(new Error('[internal] governance.identity_maps.delete failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: mutationContextId,
            resourceKind: 'governance.identity_map',
            resourceId: row.id,
            retryLastMutation,
          },
          mutationPayload: { id: row.id },
        })
        flash(t('governance.identityMaps.flash.deleted'), 'success')
        setReloadToken((token) => token + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((token) => token + 1) })) return
        flash(t('governance.identityMaps.flash.deleteFailed'), 'error')
      }
    },
    [confirmDialog, mutationContextId, retryLastMutation, runMutation, t],
  )

  const columns = React.useMemo<ColumnDef<IdentityMapRow>[]>(
    () => [
      {
        accessorKey: 'sourceEntityId',
        header: t('governance.identityMaps.table.source'),
        cell: ({ row }) => (
          <Link
            className="font-medium text-primary hover:underline"
            href={`/backend/governance/identity-maps/${row.original.id}`}
          >
            {row.original.sourceEntityId.slice(0, 8)}…
          </Link>
        ),
      },
      {
        accessorKey: 'canonicalEntityId',
        header: t('governance.identityMaps.table.canonical'),
        cell: ({ row }) => `${row.original.canonicalEntityId.slice(0, 8)}…`,
      },
      {
        accessorKey: 'status',
        header: t('governance.identityMaps.table.status'),
        cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
      },
      {
        accessorKey: 'rationale',
        header: t('governance.identityMaps.table.rationale'),
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-md text-muted-foreground">{row.original.rationale}</span>
        ),
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('governance.identityMaps.page.title')}
          columns={columns}
          data={rows}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('governance.identityMaps.list.searchPlaceholder')}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/backend/governance/findings">{t('governance.findings.page.title')}</Link>
              </Button>
              <Button asChild>
                <Link href="/backend/governance/identity-maps/create">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('governance.identityMaps.actions.create')}
                </Link>
              </Button>
            </div>
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'edit',
                  label: t('governance.actions.edit'),
                  href: `/backend/governance/identity-maps/${row.id}`,
                },
                {
                  id: 'delete',
                  label: t('governance.actions.delete'),
                  destructive: true,
                  onSelect: () => handleDelete(row),
                },
              ]}
            />
          )}
          emptyState={
            <ListEmptyState
              entityName={t('governance.identityMaps.page.title')}
              createHref="/backend/governance/identity-maps/create"
              createLabel={t('governance.identityMaps.actions.create')}
            />
          }
          pagination={{ page, pageSize: 50, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
          perspective={{ tableId: 'governance.identity_maps.list' }}
          injectionContext={{ entityType: 'governance.identity_map' }}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
