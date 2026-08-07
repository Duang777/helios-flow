'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { DataTable } from '@helios/ui/backend/DataTable'
import { ListEmptyState } from '@helios/ui/backend/filters/ListEmptyState'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@helios/ui/primitives/badge'
import { Button } from '@helios/ui/primitives/button'
import { Plus } from 'lucide-react'
import { useT } from '@helios/shared/lib/i18n/context'
import { apiCall } from '@helios/ui/backend/utils/apiCall'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@helios/shared/lib/frontend/useOrganizationScope'

type MilestoneRow = {
  id: string
  projectId: string
  name: string
  status: string
  plannedDate: string | null
  actualDate: string | null
  isDelayed: boolean
}

type ResponsePayload = {
  items: MilestoneRow[]
  total: number
  page: number
  totalPages: number
}

export default function MilestonesPage() {
  const t = useT()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') || ''
  const [rows, setRows] = React.useState<MilestoneRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [isLoading, setIsLoading] = React.useState(true)
  const scopeVersion = useOrganizationScopeVersion()

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('pageSize', '50')
        if (projectId) params.set('projectId', projectId)
        const fallback: ResponsePayload = { items: [], total: 0, page, totalPages: 1 }
        const call = await apiCall<ResponsePayload>(`/api/projects/milestones?${params.toString()}`, undefined, {
          fallback,
        })
        if (!call.ok) {
          flash(t('projects.milestones.list.error.load'), 'error')
          return
        }
        const payload = call.result ?? fallback
        if (!cancelled) {
          setRows(Array.isArray(payload.items) ? payload.items : [])
          setTotal(payload.total || 0)
          setTotalPages(payload.totalPages || 1)
        }
      } catch {
        if (!cancelled) flash(t('projects.milestones.list.error.load'), 'error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [page, projectId, scopeVersion, t])

  const columns = React.useMemo<ColumnDef<MilestoneRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('projects.milestones.table.name'),
        cell: ({ row }) => (
          <Link className="font-medium text-primary hover:underline" href={`/backend/milestones/${row.original.id}`}>
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'status',
        header: t('projects.milestones.table.status'),
        cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
      },
      {
        accessorKey: 'plannedDate',
        header: t('projects.milestones.table.plannedDate'),
        cell: ({ row }) => row.original.plannedDate || '—',
      },
      {
        accessorKey: 'isDelayed',
        header: t('projects.milestones.table.delayed'),
        cell: ({ row }) =>
          row.original.isDelayed ? (
            <Badge variant="destructive">{t('projects.milestones.table.delayedYes')}</Badge>
          ) : (
            '—'
          ),
      },
    ],
    [t],
  )

  const createHref = projectId
    ? `/backend/milestones/create?projectId=${encodeURIComponent(projectId)}`
    : '/backend/milestones/create'

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('projects.milestones.page.title')}
          columns={columns}
          data={rows}
          actions={
            <Button asChild>
              <Link href={createHref}>
                <Plus className="mr-2 h-4 w-4" />
                {t('projects.milestones.actions.create')}
              </Link>
            </Button>
          }
          emptyState={
            <ListEmptyState
              entityName={t('projects.milestones.page.title')}
              createHref={createHref}
              createLabel={t('projects.milestones.actions.create')}
            />
          }
          pagination={{ page, pageSize: 50, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
          perspective={{ tableId: 'projects.milestones.list' }}
        />
      </PageBody>
    </Page>
  )
}
