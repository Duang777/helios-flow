'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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

type PaymentRow = {
  id: string
  organizationId: string
  tenantId: string
  updatedAt: string
  isActive: boolean
  paymentNo: string | null
  status: string
  amount: string | null
  paidOn: string | null
}

type ResponsePayload = {
  items: PaymentRow[]
  total: number
  page: number
  totalPages: number
}

export default function PaymentPage() {
  const t = useT()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const searchParams = useSearchParams()
  const customerEntityId = searchParams.get('customerEntityId') || ''
  const [search, setSearch] = React.useState('')
  const [rows, setRows] = React.useState<PaymentRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const scopeVersion = useOrganizationScopeVersion()
  const mutationContextId = 'commercial-payments-list:mutation'
  const { runMutation, retryLastMutation } = useGuardedMutation<{
    formId: string
    resourceKind: string
    resourceId: string
    retryLastMutation: () => Promise<boolean>
  }>({
    contextId: mutationContextId,
    blockedMessage: t('ui.forms.flash.saveBlocked', 'Save blocked by validation'),
  })

  const createHref = React.useMemo(() => {
    const params = new URLSearchParams()
    if (customerEntityId) params.set('customerEntityId', customerEntityId)
    const query = params.toString()
    return query ? `/backend/commercial/payments/create?${query}` : '/backend/commercial/payments/create'
  }, [customerEntityId])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('pageSize', '50')
        if (search) params.set('search', search)
        if (customerEntityId) params.set('customerEntityId', customerEntityId)
        const fallback: ResponsePayload = { items: [], total: 0, page, totalPages: 1 }
        const call = await apiCall<ResponsePayload>(`/api/commercial/payments?${params.toString()}`, undefined, {
          fallback,
        })
        if (!call.ok) {
          flash(t('commercial.payments.list.error.load'), 'error')
          return
        }
        const payload = call.result ?? fallback
        if (!cancelled) {
          setRows(Array.isArray(payload.items) ? payload.items : [])
          setTotal(payload.total || 0)
          setTotalPages(payload.totalPages || 1)
        }
      } catch {
        if (!cancelled) flash(t('commercial.payments.list.error.load'), 'error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [page, reloadToken, scopeVersion, t, search, customerEntityId])

  const handleDelete = React.useCallback(
    async (row: PaymentRow) => {
      const confirmed = await confirmDialog({
        title: t('commercial.payments.confirm.deleteTitle'),
        description: t('commercial.payments.confirm.deleteBody'),
        variant: 'destructive',
      })
      if (!confirmed) return

      try {
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(buildOptimisticLockHeader(row.updatedAt), () =>
              apiCall(`/api/commercial/payments`, {
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
              throw Object.assign(new Error('[internal] commercial.payments.delete failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: mutationContextId,
            resourceKind: 'commercial.payment',
            resourceId: row.id,
            retryLastMutation,
          },
          mutationPayload: { id: row.id },
        })
        flash(t('commercial.payments.flash.deleted'), 'success')
        setReloadToken((token) => token + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((token) => token + 1) })) return
        flash(t('commercial.payments.flash.deleteFailed'), 'error')
      }
    },
    [confirmDialog, mutationContextId, retryLastMutation, runMutation, t],
  )

  const columns = React.useMemo<ColumnDef<PaymentRow>[]>(
    () => [
      {
        accessorKey: 'paymentNo',
        header: t('commercial.payments.table.paymentNo'),
        cell: ({ row }) => (
          <Link
            className="font-medium text-primary hover:underline"
            href={`/backend/commercial/payments/${row.original.id}`}
          >
            {row.original.paymentNo || row.original.id || '—'}
          </Link>
        ),
      },
      {
        accessorKey: 'status',
        header: t('commercial.payments.table.status'),
        cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
      },
      {
        accessorKey: 'amount',
        header: t('commercial.payments.table.amount'),
        cell: ({ row }) => row.original.amount || '—',
      },
      {
        accessorKey: 'paidOn',
        header: t('commercial.payments.table.paidOn'),
        cell: ({ row }) => row.original.paidOn || '—',
      }
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('commercial.payments.page.title')}
          columns={columns}
          data={rows}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('commercial.payments.list.searchPlaceholder')}
          actions={
            <Button asChild>
              <Link href={createHref}>
                <Plus className="mr-2 h-4 w-4" />
                {t('commercial.payments.actions.create')}
              </Link>
            </Button>
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'edit',
                  label: t('commercial.actions.edit'),
                  href: `/backend/commercial/payments/${row.id}`,
                },
                {
                  id: 'delete',
                  label: t('commercial.actions.delete'),
                  destructive: true,
                  onSelect: () => handleDelete(row),
                },
              ]}
            />
          )}
          emptyState={
            <ListEmptyState
              entityName={t('commercial.payments.page.title')}
              createHref={createHref}
              createLabel={t('commercial.payments.actions.create')}
            />
          }
          pagination={{ page, pageSize: 50, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
          perspective={{ tableId: 'commercial.payments.list' }}
          injectionContext={{
            entityType: 'commercial.payment',
            customerEntityId: customerEntityId || undefined,
            visibleFilters: customerEntityId ? { customerEntityId } : undefined,
          }}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
