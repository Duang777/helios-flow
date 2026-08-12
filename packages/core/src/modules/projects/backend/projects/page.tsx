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

type ProjectRow = {
  id: string
  name: string
  code: string | null
  status: string
  isActive: boolean
  organizationId: string
  tenantId: string
  updatedAt: string
}

type ResponsePayload = {
  items: ProjectRow[]
  total: number
  page: number
  totalPages: number
}

export default function ProjectsPage() {
  const t = useT()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<ProjectRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const scopeVersion = useOrganizationScopeVersion()
  const mutationContextId = 'projects-list:mutation'
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
        const call = await apiCall<ResponsePayload>(`/api/projects/projects?${params.toString()}`, undefined, {
          fallback,
        })
        if (!call.ok) {
          flash(t('projects.list.error.load'), 'error')
          return
        }
        const payload = call.result ?? fallback
        if (!cancelled) {
          setRows(Array.isArray(payload.items) ? payload.items : [])
          setTotal(payload.total || 0)
          setTotalPages(payload.totalPages || 1)
        }
      } catch {
        if (!cancelled) flash(t('projects.list.error.load'), 'error')
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
    async (row: ProjectRow) => {
      const confirmed = await confirmDialog({
        title: t('projects.confirm.deleteTitle'),
        description: t('projects.confirm.deleteBody'),
        variant: 'destructive',
      })
      if (!confirmed) return

      try {
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(buildOptimisticLockHeader(row.updatedAt), () =>
              apiCall(`/api/projects/projects`, {
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
              throw Object.assign(new Error('[internal] projects.delete failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: mutationContextId,
            resourceKind: 'projects.project',
            resourceId: row.id,
            retryLastMutation,
          },
          mutationPayload: { id: row.id },
        })
        flash(t('projects.flash.deleted'), 'success')
        setReloadToken((token) => token + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((token) => token + 1) })) return
        flash(t('projects.flash.deleteFailed'), 'error')
      }
    },
    [confirmDialog, mutationContextId, retryLastMutation, runMutation, t],
  )

  const columns = React.useMemo<ColumnDef<ProjectRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('projects.table.name'),
        cell: ({ row }) => (
          <Link className="font-medium text-primary hover:underline" href={`/backend/projects/${row.original.id}`}>
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'code',
        header: t('projects.table.code'),
        cell: ({ row }) => row.original.code || '—',
      },
      {
        accessorKey: 'status',
        header: t('projects.table.status'),
        cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('projects.page.title')}
          columns={columns}
          data={rows}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('projects.list.searchPlaceholder')}
          actions={
            <Button asChild>
              <Link href="/backend/projects/create">
                <Plus className="mr-2 h-4 w-4" />
                {t('projects.actions.create')}
              </Link>
            </Button>
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'edit',
                  label: t('projects.actions.edit'),
                  href: `/backend/projects/${row.id}`,
                },
                {
                  id: 'delete',
                  label: t('projects.actions.delete'),
                  destructive: true,
                  onSelect: () => handleDelete(row),
                },
              ]}
            />
          )}
          emptyState={
            <ListEmptyState
              entityName={t('projects.page.title')}
              createHref="/backend/projects/create"
              createLabel={t('projects.actions.create')}
            />
          }
          pagination={{ page, pageSize: 50, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
          perspective={{ tableId: 'projects.list' }}
          injectionContext={{ entityType: 'projects.project' }}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
