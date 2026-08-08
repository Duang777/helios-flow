'use client'

import * as React from 'react'
import Link from 'next/link'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { DataTable } from '@helios/ui/backend/DataTable'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@helios/ui/primitives/button'
import { Input } from '@helios/ui/primitives/input'
import { Label } from '@helios/ui/primitives/label'
import { Checkbox } from '@helios/ui/primitives/checkbox'
import { Badge } from '@helios/ui/primitives/badge'
import { useT } from '@helios/shared/lib/i18n/context'
import { apiCall } from '@helios/ui/backend/utils/apiCall'
import { flash } from '@helios/ui/backend/FlashMessages'
import { useOrganizationScopeDetail, useOrganizationScopeVersion } from '@helios/shared/lib/frontend/useOrganizationScope'

type CompletionRow = {
  organizationId: string
  metricKey: string
  targetValue: string | null
  actualValue: string | null
  completionRate: string | null
  unit: 'amount' | 'ratio'
  currencyCode: string | null
  actualSource: string
  isRollup?: boolean
}

type CompletionResponse = {
  items: CompletionRow[]
  rollup: CompletionRow[]
  asOf: string
  periodType: string
  periodKey: string
}

export default function KpiCompletionBoardPage() {
  const t = useT()
  const { organizationId } = useOrganizationScopeDetail()
  const scopeVersion = useOrganizationScopeVersion()
  const [periodType, setPeriodType] = React.useState('year')
  const [periodKey, setPeriodKey] = React.useState(String(new Date().getFullYear()))
  const [asOf, setAsOf] = React.useState(new Date().toISOString().slice(0, 10))
  const [includeDescendants, setIncludeDescendants] = React.useState(false)
  const [rows, setRows] = React.useState<CompletionRow[]>([])
  const [rollupRows, setRollupRows] = React.useState<CompletionRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    if (!organizationId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        organizationId,
        periodType,
        periodKey,
        asOf,
        includeDescendants: includeDescendants ? 'true' : 'false',
      })
      const fallback: CompletionResponse = {
        items: [],
        rollup: [],
        asOf,
        periodType,
        periodKey,
      }
      const call = await apiCall<CompletionResponse>(
        `/api/insights/kpi/completion?${params.toString()}`,
        undefined,
        { fallback },
      )
      if (!call.ok) {
        flash(t('insights.kpi.board.error.load'), 'error')
        return
      }
      const payload = call.result ?? fallback
      setRows(Array.isArray(payload.items) ? payload.items : [])
      setRollupRows(Array.isArray(payload.rollup) ? payload.rollup : [])
    } catch {
      flash(t('insights.kpi.board.error.load'), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [asOf, includeDescendants, organizationId, periodKey, periodType, t])

  React.useEffect(() => {
    void load()
  }, [load, scopeVersion])

  const metricLabel = React.useCallback(
    (key: string) => t(`insights.metric.${key}`, key),
    [t],
  )

  const formatValue = React.useCallback((row: CompletionRow, value: string | null) => {
    if (value === null) return '—'
    if (row.unit === 'ratio') return `${value}%`
    return row.currencyCode ? `${value} ${row.currencyCode}` : value
  }, [])

  const columns = React.useMemo<ColumnDef<CompletionRow>[]>(
    () => [
      {
        accessorKey: 'organizationId',
        header: t('insights.kpi.board.table.organization'),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.organizationId.slice(0, 8)}…</span>
        ),
      },
      {
        accessorKey: 'metricKey',
        header: t('insights.kpi.board.table.metric'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {metricLabel(row.original.metricKey)}
            {row.original.isRollup ? (
              <Badge variant="secondary">{t('insights.kpi.board.rollupLabel')}</Badge>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'targetValue',
        header: t('insights.kpi.board.table.target'),
        cell: ({ row }) => formatValue(row.original, row.original.targetValue),
      },
      {
        accessorKey: 'actualValue',
        header: t('insights.kpi.board.table.actual'),
        cell: ({ row }) => formatValue(row.original, row.original.actualValue),
      },
      {
        accessorKey: 'completionRate',
        header: t('insights.kpi.board.table.completion'),
        cell: ({ row }) =>
          row.original.completionRate ? `${row.original.completionRate}%` : '—',
      },
      {
        accessorKey: 'actualSource',
        header: t('insights.kpi.board.table.source'),
        cell: ({ row }) => <Badge variant="outline">{row.original.actualSource}</Badge>,
      },
    ],
    [formatValue, metricLabel, t],
  )

  const tableData = React.useMemo(
    () => [...rows, ...rollupRows.map((row) => ({ ...row, isRollup: true }))],
    [rollupRows, rows],
  )

  return (
    <Page>
      <PageBody>
        <div className="mb-6 grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="periodType">{t('insights.kpi.board.periodType')}</Label>
            <select
              id="periodType"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={periodType}
              onChange={(event) => setPeriodType(event.target.value)}
            >
              <option value="year">{t('insights.period.year')}</option>
              <option value="quarter">{t('insights.period.quarter')}</option>
              <option value="month">{t('insights.period.month')}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="periodKey">{t('insights.kpi.board.periodKey')}</Label>
            <Input id="periodKey" value={periodKey} onChange={(event) => setPeriodKey(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asOf">{t('insights.kpi.board.asOf')}</Label>
            <Input id="asOf" type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
          </div>
          <div className="flex flex-col justify-end gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeDescendants}
                onCheckedChange={(checked) => setIncludeDescendants(checked === true)}
              />
              {t('insights.kpi.board.includeDescendants')}
            </label>
            <div className="flex gap-2">
              <Button onClick={() => void load()}>{t('insights.kpi.board.refresh')}</Button>
              <Button variant="outline" asChild>
                <Link href="/backend/insights/kpi-targets">{t('insights.kpiTargets.page.title')}</Link>
              </Button>
            </div>
          </div>
        </div>
        <DataTable
          title={t('insights.kpi.board.title')}
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          perspective={{ tableId: 'insights.kpi.completion' }}
        />
      </PageBody>
    </Page>
  )
}
