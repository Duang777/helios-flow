'use client'

import * as React from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { DataTable } from '@helios/ui/backend/DataTable'
import { ListEmptyState } from '@helios/ui/backend/filters/ListEmptyState'
import { Badge } from '@helios/ui/primitives/badge'
import { Button } from '@helios/ui/primitives/button'
import { apiCall } from '@helios/ui/backend/utils/apiCall'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useT } from '@helios/shared/lib/i18n/context'

type ListResponse<T> = {
  items: T[]
  total: number
  page: number
  totalPages: number
}

type MilestoneRow = {
  id: string
  name: string
  status: string
  plannedDate: string | null
  actualDate: string | null
  isDelayed: boolean
}

type RiskRow = {
  id: string
  title: string
  riskType: string
  status: string
  ownerEmployeeId: string | null
}

export function ProjectMilestonesPanel({ projectId }: { projectId: string }) {
  const t = useT()
  const [rows, setRows] = React.useState<MilestoneRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const createHref = `/backend/milestones/create?projectId=${encodeURIComponent(projectId)}`

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          page: '1',
          pageSize: '50',
          projectId,
        })
        const fallback: ListResponse<MilestoneRow> = { items: [], total: 0, page: 1, totalPages: 1 }
        const call = await apiCall<ListResponse<MilestoneRow>>(
          `/api/projects/milestones?${params.toString()}`,
          undefined,
          { fallback },
        )
        if (!call.ok) {
          flash(t('projects.detail.embedded.error.milestones'), 'error')
          return
        }
        if (!cancelled) setRows(Array.isArray(call.result?.items) ? call.result.items : [])
      } catch {
        if (!cancelled) flash(t('projects.detail.embedded.error.milestones'), 'error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [projectId, t])

  const columns = React.useMemo<ColumnDef<MilestoneRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('projects.milestones.table.name'),
        cell: ({ row }) => (
          <Link
            className="font-medium text-primary hover:underline"
            href={`/backend/milestones/${row.original.id}`}
          >
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild size="sm">
          <Link href={createHref}>
            <Plus className="size-4" />
            {t('projects.milestones.actions.create')}
          </Link>
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyState={
          <ListEmptyState
            title={t('projects.detail.embedded.empty.milestones')}
            createHref={createHref}
            createLabel={t('projects.milestones.actions.create')}
          />
        }
      />
    </div>
  )
}

export function ProjectRisksPanel({ projectId }: { projectId: string }) {
  const t = useT()
  const [rows, setRows] = React.useState<RiskRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const createHref = `/backend/risks/create?projectId=${encodeURIComponent(projectId)}`

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          page: '1',
          pageSize: '50',
          projectId,
        })
        const fallback: ListResponse<RiskRow> = { items: [], total: 0, page: 1, totalPages: 1 }
        const call = await apiCall<ListResponse<RiskRow>>(
          `/api/projects/risks?${params.toString()}`,
          undefined,
          { fallback },
        )
        if (!call.ok) {
          flash(t('projects.detail.embedded.error.risks'), 'error')
          return
        }
        if (!cancelled) setRows(Array.isArray(call.result?.items) ? call.result.items : [])
      } catch {
        if (!cancelled) flash(t('projects.detail.embedded.error.risks'), 'error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [projectId, t])

  const columns = React.useMemo<ColumnDef<RiskRow>[]>(
    () => [
      {
        accessorKey: 'title',
        header: t('projects.risks.table.title'),
        cell: ({ row }) => (
          <Link
            className="font-medium text-primary hover:underline"
            href={`/backend/risks/${row.original.id}`}
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: 'riskType',
        header: t('projects.risks.table.riskType'),
        cell: ({ row }) => <Badge variant="outline">{row.original.riskType}</Badge>,
      },
      {
        accessorKey: 'status',
        header: t('projects.risks.table.status'),
        cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
      },
    ],
    [t],
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild size="sm">
          <Link href={createHref}>
            <Plus className="size-4" />
            {t('projects.risks.actions.create')}
          </Link>
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyState={
          <ListEmptyState
            title={t('projects.detail.embedded.empty.risks')}
            createHref={createHref}
            createLabel={t('projects.risks.actions.create')}
          />
        }
      />
    </div>
  )
}
