'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CalendarClock,
  ExternalLink,
  FileWarning,
  RefreshCw,
  TrendingDown,
} from 'lucide-react'
import { useT } from '@helios/shared/lib/i18n/context'
import { cn } from '@helios/shared/lib/utils'
import { useOrganizationScopeDetail, useOrganizationScopeVersion } from '@helios/shared/lib/frontend/useOrganizationScope'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { ErrorMessage, LoadingMessage } from '@helios/ui/backend/detail'
import { AiIcon } from '@helios/ui/ai/AiIcon'
import { AiChat, type AiChatContextItem, type AiChatSuggestion } from '@helios/ui/ai/AiChat'
import { Alert, AlertDescription, AlertTitle } from '@helios/ui/primitives/alert'
import { Badge } from '@helios/ui/primitives/badge'
import { Button } from '@helios/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@helios/ui/primitives/dialog'
import { EmptyState } from '@helios/ui/primitives/empty-state'
import { apiCall } from '@helios/ui/backend/utils/apiCall'
import { flash } from '@helios/ui/backend/FlashMessages'
import { OPERATING_LOOP_ASSISTANT_ID } from '../../../../widgets/injection/operating-loop-trigger/widget.client'

type DigestGroupKey = 'criticalFindings' | 'overdueInvoices' | 'delayedProjects' | 'kpiGaps'

type DigestStatus = {
  ok: boolean
  message?: string
}

type DigestDetail = {
  id: string
  title: string
  description: string | null
  severity: 'critical' | 'warning' | 'info'
  entityType: 'governance.finding' | 'commercial.invoice' | 'projects.project' | 'insights.kpi_target'
  recordId: string
  organizationId: string
  href: string
  formulaSource: string
  amount: string | null
  currencyCode: string | null
  evidenceIds: Array<{ type: string; id: string; module: string }>
  scopedIds: Record<string, string | undefined>
  facts: Record<string, string | number | null>
}

type DigestPayload = {
  asOf: string
  periodType: string
  periodKey: string
  formulaSources: string
  metrics: {
    criticalFindingCount: number
    delayedProjectCount: number
    overdueInvoiceCount: number
    overdueOutstanding: string
    kpiGapCount: number
    periodType: string
    periodKey: string
  }
  groups: Record<DigestGroupKey, DigestDetail[]>
  sourceStatus: Record<DigestGroupKey, DigestStatus>
}

type ActiveAdvisor = {
  groupKey: DigestGroupKey
  item: DigestDetail | null
}

const GROUP_KEYS: DigestGroupKey[] = ['criticalFindings', 'overdueInvoices', 'delayedProjects', 'kpiGaps']

const GROUP_ICONS: Record<DigestGroupKey, React.ComponentType<{ className?: string }>> = {
  criticalFindings: AlertTriangle,
  overdueInvoices: TrendingDown,
  delayedProjects: CalendarClock,
  kpiGaps: BarChart3,
}

const GROUP_ENTITY_TYPES: Record<DigestGroupKey, DigestDetail['entityType']> = {
  criticalFindings: 'governance.finding',
  overdueInvoices: 'commercial.invoice',
  delayedProjects: 'projects.project',
  kpiGaps: 'insights.kpi_target',
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatAmount(item: DigestDetail): string | null {
  if (!item.amount) return null
  return item.currencyCode ? `${item.amount} ${item.currencyCode}` : item.amount
}

function contextItemsForAdvisor(active: ActiveAdvisor | null, organizationId?: string): AiChatContextItem[] {
  if (!active) return []
  const items: AiChatContextItem[] = []
  if (organizationId) items.push({ label: 'organizationId', detail: organizationId })
  if (active.item) {
    items.push({ label: active.item.entityType, detail: active.item.recordId })
    for (const [key, value] of Object.entries(active.item.scopedIds)) {
      if (value) items.push({ label: key, detail: value })
    }
  } else {
    items.push({ label: 'digestGroup', detail: active.groupKey })
  }
  return items
}

function buildAdvisorContext(input: {
  active: ActiveAdvisor
  organizationId?: string
  asOf: string
  periodKey: string
}): Record<string, unknown> {
  const item = input.active.item
  return {
    view: item ? 'operating_loop.detail' : 'operating_loop.list',
    entityType: item?.entityType ?? GROUP_ENTITY_TYPES[input.active.groupKey],
    recordType: item?.entityType.split('.').at(-1) ?? input.active.groupKey,
    recordId: item?.recordId ?? null,
    organizationId: item?.organizationId ?? input.organizationId,
    tableId: item ? undefined : `insights.operating_loop.${input.active.groupKey}`,
    visibleFilters: {
      asOf: input.asOf,
      periodKey: input.periodKey,
      groupKey: input.active.groupKey,
    },
    extra: item?.scopedIds ?? {},
    selectedRecordIds: item ? [item.recordId] : undefined,
  }
}

function buildSuggestions(
  t: (key: string, fallback?: string) => string,
  active: ActiveAdvisor | null,
): AiChatSuggestion[] {
  const groupKey = active?.groupKey ?? 'criticalFindings'
  const title = active?.item?.title ?? t(`insights.operatingLoop.today.groups.${groupKey}.title`)
  return [
    {
      label: t('insights.operatingLoop.today.ai.suggestExplain.label'),
      prompt: t('insights.operatingLoop.today.ai.suggestExplain.prompt', '').replace('{title}', title),
    },
    {
      label: t('insights.operatingLoop.today.ai.suggestAction.label'),
      prompt: t('insights.operatingLoop.today.ai.suggestAction.prompt', '').replace('{title}', title),
    },
    {
      label: t('insights.operatingLoop.today.ai.suggestPreview.label'),
      prompt: t('insights.operatingLoop.today.ai.suggestPreview.prompt', '').replace('{title}', title),
    },
  ]
}

function describeItem(t: (key: string, fallback?: string) => string, groupKey: DigestGroupKey, item: DigestDetail): string {
  if (groupKey === 'overdueInvoices') {
    const dueDate = typeof item.facts.dueDate === 'string' ? item.facts.dueDate : '-'
    return t('insights.operatingLoop.today.item.overdueInvoice.description')
      .replace('{dueDate}', dueDate)
      .replace('{amount}', formatAmount(item) ?? '-')
  }
  if (groupKey === 'delayedProjects') {
    const milestone = item.description ?? '-'
    const plannedDate = typeof item.facts.plannedDate === 'string' ? item.facts.plannedDate : '-'
    return t('insights.operatingLoop.today.item.delayedProject.description')
      .replace('{milestone}', milestone)
      .replace('{plannedDate}', plannedDate)
  }
  if (groupKey === 'kpiGaps') {
    const completionRate = typeof item.facts.completionRate === 'string' ? `${item.facts.completionRate}%` : '-'
    const targetValue = typeof item.facts.targetValue === 'string' ? item.facts.targetValue : '-'
    const actualValue = typeof item.facts.actualValue === 'string' ? item.facts.actualValue : '-'
    return t('insights.operatingLoop.today.item.kpiGap.description')
      .replace('{completionRate}', completionRate)
      .replace('{actualValue}', actualValue)
      .replace('{targetValue}', targetValue)
  }
  return item.description ?? t('insights.operatingLoop.today.item.finding.descriptionFallback')
}

function metricLabel(t: (key: string, fallback?: string) => string, key: string): string {
  return t(`insights.metric.${key}`, key)
}

function displayTitle(t: (key: string, fallback?: string) => string, groupKey: DigestGroupKey, item: DigestDetail): string {
  if (groupKey === 'overdueInvoices') {
    return t('insights.operatingLoop.today.item.overdueInvoice.title').replace('{invoiceNo}', item.title)
  }
  if (groupKey === 'kpiGaps') {
    return metricLabel(t, item.title)
  }
  return item.title
}

function DigestGroup({
  digest,
  groupKey,
  onAsk,
}: {
  digest: DigestPayload
  groupKey: DigestGroupKey
  onAsk: (active: ActiveAdvisor) => void
}) {
  const t = useT()
  const Icon = GROUP_ICONS[groupKey]
  const items = digest.groups[groupKey]
  const status = digest.sourceStatus[groupKey]

  return (
    <section
      className="rounded-lg border border-border bg-background"
      data-operating-loop-digest-group={groupKey}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t(`insights.operatingLoop.today.groups.${groupKey}.title`)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(`insights.operatingLoop.today.groups.${groupKey}.description`)}
            </p>
          </div>
        </div>
        <Badge variant={status.ok ? 'secondary' : 'outline'}>
          {status.ok
            ? t('insights.operatingLoop.today.groups.count').replace('{count}', String(items.length))
            : t('insights.operatingLoop.today.groups.sourceFailed')}
        </Badge>
      </div>
      {!status.ok ? (
        <div className="p-4">
          <Alert variant="warning">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertTitle>{t('insights.operatingLoop.today.sourceFailed.title')}</AlertTitle>
            <AlertDescription>{status.message ?? t('insights.operatingLoop.today.sourceFailed.body')}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      {status.ok && items.length === 0 ? (
        <div className="p-4">
          <EmptyState
            size="sm"
            variant="subtle"
            icon={<FileWarning className="size-5" />}
            title={t(`insights.operatingLoop.today.groups.${groupKey}.emptyTitle`)}
            description={t(`insights.operatingLoop.today.groups.${groupKey}.emptyDescription`)}
          />
        </div>
      ) : null}
      {items.length > 0 ? (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div key={`${groupKey}:${item.id}`} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto]">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">{displayTitle(t, groupKey, item)}</h3>
                  <Badge variant={item.severity === 'critical' ? 'destructive' : 'outline'}>
                    {t(`insights.operatingLoop.today.severity.${item.severity}`)}
                  </Badge>
                  {formatAmount(item) ? <Badge variant="secondary">{formatAmount(item)}</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">{describeItem(t, groupKey, item)}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{t('insights.operatingLoop.today.item.formulaSource')}: {item.formulaSource}</span>
                  <span>{t('insights.operatingLoop.today.item.recordId')}: {item.recordId}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Button variant="outline" size="sm" asChild>
                  <Link href={item.href}>
                    <ExternalLink className="size-4" aria-hidden="true" />
                    <span>{t('insights.operatingLoop.today.actions.openRecord')}</span>
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onAsk({ groupKey, item })}
                  data-operating-loop-digest-ai-trigger={groupKey}
                >
                  <Bot className="size-4" aria-hidden="true" />
                  <span>{t('insights.operatingLoop.today.actions.askAdvisor')}</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default function TodayOperatingDigestPage() {
  const t = useT()
  const { organizationId } = useOrganizationScopeDetail()
  const scopeVersion = useOrganizationScopeVersion()
  const [asOf, setAsOf] = React.useState(todayUtcDate())
  const [digest, setDigest] = React.useState<DigestPayload | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [activeAdvisor, setActiveAdvisor] = React.useState<ActiveAdvisor | null>(null)

  const load = React.useCallback(async () => {
    if (!organizationId) {
      setIsLoading(false)
      setDigest(null)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ organizationId, asOf })
      const call = await apiCall<DigestPayload>(`/api/insights/operating-loop/today?${params.toString()}`)
      if (!call.ok || !call.result) {
        setError(t('insights.operatingLoop.today.error.load'))
        flash(t('insights.operatingLoop.today.error.load'), 'error')
        return
      }
      setDigest(call.result)
    } catch {
      setError(t('insights.operatingLoop.today.error.load'))
      flash(t('insights.operatingLoop.today.error.load'), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [asOf, organizationId, t])

  React.useEffect(() => {
    void load()
  }, [load, scopeVersion])

  const metrics = digest?.metrics
  const totalSignals = metrics
    ? metrics.criticalFindingCount + metrics.delayedProjectCount + metrics.overdueInvoiceCount + metrics.kpiGapCount
    : 0
  const advisorContext = activeAdvisor && digest
    ? buildAdvisorContext({
        active: activeAdvisor,
        organizationId: organizationId ?? undefined,
        asOf: digest.asOf,
        periodKey: digest.periodKey,
      })
    : null
  const advisorSuggestions = React.useMemo(() => buildSuggestions(t, activeAdvisor), [activeAdvisor, t])
  const advisorContextItems = React.useMemo(
    () => contextItemsForAdvisor(activeAdvisor, organizationId ?? undefined),
    [activeAdvisor, organizationId],
  )

  return (
    <Page>
      <PageBody>
        <div className="space-y-5" data-operating-loop-digest-page="">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold">{t('insights.operatingLoop.today.title')}</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                {t('insights.operatingLoop.today.subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm text-muted-foreground" htmlFor="operating-loop-as-of">
                {t('insights.operatingLoop.today.asOf')}
              </label>
              <input
                id="operating-loop-as-of"
                type="date"
                value={asOf}
                onChange={(event) => setAsOf(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                <RefreshCw className="size-4" aria-hidden="true" />
                <span>{t('insights.operatingLoop.today.actions.refresh')}</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setActiveAdvisor({ groupKey: 'criticalFindings', item: null })}
                data-operating-loop-digest-ai-trigger="summary"
              >
                <AiIcon className="size-4" />
                <span>{t('insights.operatingLoop.today.actions.askSummary')}</span>
              </Button>
            </div>
          </div>

          {isLoading ? <LoadingMessage label={t('insights.operatingLoop.today.loading')} /> : null}
          {!isLoading && error ? <ErrorMessage label={error} /> : null}

          {!isLoading && !error && digest ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-operating-loop-digest-metrics="">
                <MetricCard
                  label={t('insights.operatingLoop.today.metrics.criticalFindings')}
                  value={String(digest.metrics.criticalFindingCount)}
                />
                <MetricCard
                  label={t('insights.operatingLoop.today.metrics.overdueInvoices')}
                  value={String(digest.metrics.overdueInvoiceCount)}
                  detail={digest.metrics.overdueOutstanding}
                />
                <MetricCard
                  label={t('insights.operatingLoop.today.metrics.delayedProjects')}
                  value={String(digest.metrics.delayedProjectCount)}
                />
                <MetricCard
                  label={t('insights.operatingLoop.today.metrics.kpiGaps')}
                  value={String(digest.metrics.kpiGapCount)}
                  detail={digest.periodKey}
                />
              </div>

              <Alert variant="info">
                <AlertDescription>
                  {t('insights.operatingLoop.today.formulaSources')}: {digest.formulaSources}
                </AlertDescription>
              </Alert>

              {totalSignals === 0 ? (
                <EmptyState
                  icon={<FileWarning className="size-6" />}
                  title={t('insights.operatingLoop.today.empty.title')}
                  description={t('insights.operatingLoop.today.empty.description')}
                />
              ) : null}

              <div className="grid gap-4">
                {GROUP_KEYS.map((groupKey) => (
                  <DigestGroup key={groupKey} digest={digest} groupKey={groupKey} onAsk={setActiveAdvisor} />
                ))}
              </div>
            </>
          ) : null}
        </div>

        <Dialog open={Boolean(activeAdvisor)} onOpenChange={(open) => !open && setActiveAdvisor(null)}>
          <DialogContent
            className={cn(
              'flex flex-col gap-3 p-4',
              'sm:bottom-0 sm:left-auto sm:right-0 sm:top-0 sm:h-screen sm:max-h-screen sm:max-w-xl sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:rounded-l-2xl',
            )}
            data-operating-loop-digest-ai-sheet=""
          >
            <DialogHeader>
              <DialogTitle>{t('insights.operatingLoop.today.ai.title')}</DialogTitle>
              <DialogDescription>{t('insights.operatingLoop.today.ai.description')}</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1">
              {advisorContext ? (
                <AiChat
                  agent={OPERATING_LOOP_ASSISTANT_ID}
                  pageContext={advisorContext}
                  className="h-full"
                  suggestions={advisorSuggestions}
                  contextItems={advisorContextItems}
                  placeholder={t('insights.operatingLoop.today.ai.placeholder')}
                  welcomeTitle={t('insights.operatingLoop.today.ai.welcomeTitle')}
                  welcomeDescription={t('insights.operatingLoop.today.ai.welcomeDescription')}
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </PageBody>
    </Page>
  )
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-semibold">{value}</div>
        {detail ? <div className="text-sm text-muted-foreground">{detail}</div> : null}
      </div>
    </div>
  )
}
