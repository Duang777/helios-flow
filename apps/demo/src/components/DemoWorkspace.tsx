'use client'

import * as React from 'react'
import {
  ArrowRight,
  Bell,
  ChevronDown,
  CheckCircle2,
  CircleHelp,
  Eye,
  Home,
  Languages,
  Mail,
  Menu,
  PanelLeftClose,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  X,
  UserRound,
} from 'lucide-react'

import { cn } from '@helios/shared/lib/utils'
import { AiIcon } from '@helios/ui/ai'
import { Badge } from '@helios/ui/primitives/badge'
import { Button } from '@helios/ui/primitives/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@helios/ui/primitives/card'
import { IconButton } from '@helios/ui/primitives/icon-button'
import { Input } from '@helios/ui/primitives/input'
import { Progress } from '@helios/ui/primitives/progress'
import { StatusBadge } from '@helios/ui/primitives/status-badge'

import { DemoAiDock } from '@/components/DemoAiDock'
import {
  areaMeta,
  customerRecords,
  dashboardCards,
  demoCopy,
  metrics,
  pageContent,
  opportunityRecords,
  railApps,
  roleCards,
  sidebarGroups,
  toneLabel,
  workflows,
  type DemoArea,
  type RecordCard,
  type StatusTone,
} from '@/lib/demo-data'
import { getPageShortcuts, type DemoShortcut } from '@/lib/demo-interactions'

const toneProgress: Record<StatusTone, 'accent' | 'success' | 'warning' | 'destructive' | 'muted'> = {
  success: 'success',
  warning: 'warning',
  error: 'destructive',
  info: 'accent',
  neutral: 'muted',
}

function statusVariant(tone: StatusTone) {
  return tone === 'error' ? 'error' : tone
}

function includesSearch(values: string[], query: string) {
  if (!query.trim()) return true
  const normalized = query.trim().toLowerCase()
  return values.some((value) => value.toLowerCase().includes(normalized))
}

function actionMessage(label: string) {
  return `${label}：${demoCopy.actionSaved}`
}

function nextLocalId() {
  return Math.random().toString(36).slice(2, 10)
}

function formatActivityTime() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
}

function filterLabel(tone: StatusTone | 'all') {
  if (tone === 'all') return '全部状态'
  return toneLabel[tone]
}

function ShortcutBar({
  shortcuts,
  onRun,
}: {
  shortcuts: DemoShortcut[]
  onRun: (shortcut: DemoShortcut) => void
}) {
  if (shortcuts.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {shortcuts.map((shortcut) => (
        <Button
          key={shortcut.id}
          type="button"
          variant="outline"
          size="sm"
          title={shortcut.description}
          onClick={() => onRun(shortcut)}
        >
          {shortcut.label}
        </Button>
      ))}
    </div>
  )
}

function RecordRow({
  record,
  onOpen,
  selected,
}: {
  record: RecordCard
  onOpen: (record: RecordCard) => void
  selected?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        'grid w-full grid-cols-[minmax(0,1fr)_9rem_8rem] items-center border-b px-4 py-3 text-left transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring last:border-b-0',
        selected && 'bg-muted/40',
      )}
      onClick={() => onOpen(record)}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{record.title}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{record.meta}</p>
      </div>
      <StatusBadge variant={statusVariant(record.tone)} dot>
        {record.subtitle}
      </StatusBadge>
      <span className="flex items-center justify-end gap-1 text-xs font-medium text-muted-foreground">
        查看
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </span>
    </button>
  )
}

function ProductMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', compact && 'gap-2')}>
      <img
        src="helios.svg"
        alt=""
        className={cn('size-8 shrink-0', compact && 'size-6')}
      />
      <span className={cn('font-semibold text-foreground', compact && 'text-sm')}>
        {demoCopy.productName}
      </span>
    </div>
  )
}

function DemoIntro({ onFinish }: { onFinish: () => void }) {
  const completed = React.useRef(false)

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (completed.current) return
      completed.current = true
      onFinish()
    }, 2800)

    return () => window.clearTimeout(timer)
  }, [onFinish])

  const finish = () => {
    if (completed.current) return
    completed.current = true
    onFinish()
  }

  return (
    <main className="demo-intro min-h-screen bg-background text-foreground">
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
        <div className="demo-intro-grid" aria-hidden="true" />
        <div className="demo-intro-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
          <div className="demo-intro-mark mb-7">
            <img src="helios.svg" alt="" className="size-14" />
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Helios Demo
          </p>
          <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-5xl">
            {demoCopy.introTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {demoCopy.introSubtitle}
          </p>

          <div className="mt-9 w-full max-w-md rounded-lg border bg-card/90 p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{demoCopy.introLoading}</span>
              <span>AI · WMS · CRM</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="demo-intro-progress h-full rounded-full bg-primary" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <span className="rounded-md bg-muted px-2 py-1">经营看板</span>
              <span className="rounded-md bg-muted px-2 py-1">地图数据</span>
              <span className="rounded-md bg-muted px-2 py-1">AI 协同</span>
            </div>
          </div>

          <Button type="button" variant="ghost" className="mt-6" onClick={finish}>
            {demoCopy.skipIntro}
          </Button>
        </div>
      </section>
    </main>
  )
}

function StartExperience({ onEnter }: { onEnter: () => void }) {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <ProductMark />
          <div className="flex items-center gap-3">
            <Badge variant="muted" dot>
              {demoCopy.githubPagesNote}
            </Badge>
            <Button asChild variant="outline">
              <a href={demoCopy.repoUrl} target="_blank" rel="noreferrer">
                {demoCopy.openRepository}
              </a>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-2 lg:items-center lg:py-16">
        <Card className="border bg-card shadow-sm">
          <CardContent className="p-8">
            <div className="mb-7">
              <ProductMark />
              <h1 className="mt-5 text-2xl font-semibold">{demoCopy.loginTitle}</h1>
              <p className="mt-2 text-sm text-muted-foreground">访问您的工作区</p>
            </div>

            <div className="space-y-4">
              <label className="space-y-2">
                <span className="text-sm font-medium">邮箱</span>
                <Input
                  value={demoCopy.loginEmail}
                  readOnly
                  leftIcon={<Mail className="size-4" aria-hidden="true" />}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">密码</span>
                <Input
                  value={demoCopy.loginPassword}
                  readOnly
                  type="password"
                  rightIcon={<Eye className="size-4" aria-hidden="true" />}
                />
              </label>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <label className="flex items-center gap-2">
                  <span className="size-4 rounded-sm border bg-background" aria-hidden="true" />
                  {demoCopy.loginRemember}
                </label>
                <span>{demoCopy.loginForgot}</span>
              </div>
              <Button type="button" className="w-full" onClick={onEnter}>
                {demoCopy.loginButton}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-7 lg:pl-8">
          <ProductMark compact />
          <div>
            <h2 className="text-4xl font-semibold tracking-normal text-foreground lg:text-5xl">
              {demoCopy.heroTitle}
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              {demoCopy.startDescription}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" size="lg" onClick={onEnter}>
              <Home className="size-4" aria-hidden="true" />
              {demoCopy.enterWorkspace}
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href={demoCopy.repoUrl} target="_blank" rel="noreferrer">
                {demoCopy.openRepository}
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-6 pb-14">
        <section className="rounded-lg border bg-card p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold">{demoCopy.startTitle}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            选择角色后进入四维图新公司的模拟后台，体验客户、产品、销售、自动化等模块。
          </p>
        </section>

        <section className="rounded-lg border border-status-info-border bg-status-info-bg p-4">
          <div className="flex items-start gap-3">
            <CircleHelp className="mt-0.5 size-5 shrink-0 text-status-info-icon" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-status-info-text">{demoCopy.passwordTitle}</h3>
              <p className="mt-1 text-sm text-status-info-text">{demoCopy.passwordDescription}</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold">{demoCopy.roleTitle}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {roleCards.map((role) => {
              const Icon = role.icon
              return (
                <Card key={role.title} className="transition-all hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <span className="rounded-lg bg-primary/10 p-3 text-primary">
                        <Icon className="size-6" aria-hidden="true" />
                      </span>
                      <div>
                        <CardTitle className="text-lg">{role.title}</CardTitle>
                        <CardDescription className="mt-1">{role.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex h-full flex-col gap-4">
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">可体验能力：</p>
                      <ul className="space-y-1.5">
                        {role.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <span className="mt-1 size-1.5 rounded-full bg-primary" aria-hidden="true" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Button
                      type="button"
                      variant={role.variant === 'outline' ? 'outline' : role.variant === 'secondary' ? 'secondary' : 'default'}
                      className="mt-auto w-full"
                      onClick={onEnter}
                    >
                      以{role.title}身份登录
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      </section>
    </main>
  )
}

function ModuleExperience({
  title,
  description,
  empty,
  records,
  shortcuts,
  selectedRecord,
  statusFilter,
  onRunShortcut,
  onSetStatusFilter,
  onOpenRecord,
  onOpenNotice,
}: {
  title: string
  description: string
  empty: string
  records: RecordCard[]
  shortcuts: DemoShortcut[]
  selectedRecord: RecordCard | null
  statusFilter: StatusTone | 'all'
  onRunShortcut: (shortcut: DemoShortcut) => void
  onSetStatusFilter: (tone: StatusTone | 'all') => void
  onOpenRecord: (record: RecordCard) => void
  onOpenNotice: (label: string) => void
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-semibold">页面快捷操作</p>
            <p className="mt-1 text-xs text-muted-foreground">一键筛选、打开首条记录、切换到相邻流程。</p>
          </div>
          <ShortcutBar shortcuts={shortcuts} onRun={onRunShortcut} />
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3">
          <span className="text-sm font-semibold">状态过滤</span>
          {(['all', 'success', 'warning', 'info', 'neutral'] as Array<StatusTone | 'all'>).map((tone) => (
            <Button
              key={tone}
              type="button"
              variant={statusFilter === tone ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={statusFilter === tone}
              onClick={() => onSetStatusFilter(tone)}
            >
              {filterLabel(tone)}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="flex h-64 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
                {empty}
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <div className="grid grid-cols-[minmax(0,1fr)_9rem_8rem] border-b bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground">
                  <span>名称</span>
                  <span>状态</span>
                  <span className="text-right">操作</span>
                  </div>
                  {records.map((record) => (
                    <RecordRow
                      key={record.id}
                      record={record}
                      selected={selectedRecord?.id === record.id}
                      onOpen={onOpenRecord}
                    />
                  ))}
                </div>
              )}
          </CardContent>
        </Card>
        </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">本地交互状态</CardTitle>
          <CardDescription>这些动作都在浏览器里模拟，不连接真实后端。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" variant="outline" className="w-full justify-start" onClick={() => onOpenNotice('新增记录')}>
            <Plus className="size-4" aria-hidden="true" />
            新增记录
          </Button>
          <Button type="button" variant="outline" className="w-full justify-start" onClick={() => onOpenNotice('批量导出')}>
            <CheckCircle2 className="size-4" aria-hidden="true" />
            批量导出
          </Button>
          <Button type="button" variant="outline" className="w-full justify-start" onClick={() => onOpenNotice('同步 Helios 状态')}>
            <RefreshCw className="size-4" aria-hidden="true" />
            同步 Helios 状态
          </Button>
          {selectedRecord ? (
            <div className="rounded-md border bg-background p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">当前记录</p>
              <p className="mt-1 font-semibold">{selectedRecord.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{selectedRecord.meta}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function RecordInspector({
  record,
  organization,
  aiOpen,
  onClose,
  onFollow,
  onAskAi,
}: {
  record: RecordCard
  organization: string
  aiOpen: boolean
  onClose: () => void
  onFollow: () => void
  onAskAi: () => void
}) {
  return (
    <aside
      className={cn(
        'fixed bottom-24 left-4 right-4 z-40 rounded-xl border bg-card p-5 shadow-xl sm:left-auto sm:w-96',
        aiOpen && 'lg:left-96 lg:right-auto',
      )}
      aria-label="记录详情"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'inline-flex size-10 items-center justify-center rounded-full',
              record.tone === 'warning' && 'bg-status-warning-bg text-status-warning-icon',
              record.tone === 'error' && 'bg-status-error-bg text-status-error-icon',
              record.tone === 'info' && 'bg-status-info-bg text-status-info-icon',
              record.tone === 'success' && 'bg-status-success-bg text-status-success-icon',
              record.tone === 'neutral' && 'border border-input bg-background text-muted-foreground',
            )}
          >
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{record.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">本地模拟详情，可继续操作 AI 与页面。</p>
          </div>
        </div>
        <IconButton variant="ghost" aria-label="关闭记录详情" onClick={onClose}>
          <X className="size-4" aria-hidden="true" />
        </IconButton>
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <div className="rounded-md border bg-background p-3">
          <p className="text-xs font-medium text-muted-foreground">组织</p>
          <p className="mt-1 font-semibold">{organization}</p>
        </div>
        <div className="rounded-md border bg-background p-3">
          <p className="text-xs font-medium text-muted-foreground">状态</p>
          <div className="mt-2">
            <StatusBadge variant={statusVariant(record.tone)} dot>
              {record.subtitle}
            </StatusBadge>
          </div>
        </div>
        <div className="rounded-md border bg-background p-3">
          <p className="text-xs font-medium text-muted-foreground">说明</p>
          <p className="mt-1 leading-6">{record.meta}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onAskAi}>
          <AiIcon className="size-4" />
          询问 AI
        </Button>
        <Button type="button" onClick={onFollow}>
          加入跟进
        </Button>
      </div>
    </aside>
  )
}

function BackendExperience({ onReset }: { onReset: () => void }) {
  const [activePage, setActivePage] = React.useState<DemoArea>('dashboard')
  const [query, setQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusTone | 'all'>('all')
  const [refreshCount, setRefreshCount] = React.useState(0)
  const [selectedRecord, setSelectedRecord] = React.useState<RecordCard | null>(null)
  const [notice, setNotice] = React.useState('')
  const [customizing, setCustomizing] = React.useState(false)
  const [organization, setOrganization] = React.useState(demoCopy.organization)
  const [language, setLanguage] = React.useState('中文')
  const [aiOpen, setAiOpen] = React.useState(false)
  const [activityLog, setActivityLog] = React.useState([
    { id: 'initial-workspace', label: '进入四维图新公司工作区', time: '现在' },
  ])

  const currentArea = activePage === 'dashboard' ? areaMeta.dashboard : pageContent[activePage]

  const recordMatchesFilters = React.useCallback(
    (record: RecordCard) => statusFilter === 'all' || record.tone === statusFilter,
    [statusFilter],
  )
  const customers = React.useMemo(
    () =>
      customerRecords.filter(
        (record) =>
          includesSearch([record.title, record.subtitle, record.meta], query) &&
          recordMatchesFilters(record),
      ),
    [query, recordMatchesFilters],
  )
  const opportunities = React.useMemo(
    () =>
      opportunityRecords.filter(
        (record) =>
          includesSearch([record.title, record.subtitle, record.meta], query) &&
          recordMatchesFilters(record),
      ),
    [query, recordMatchesFilters],
  )
  const moduleRecords = React.useMemo(() => {
    if (activePage === 'dashboard') return []
    const records = pageContent[activePage].records
    return records.filter(
      (record) =>
        includesSearch([record.title, record.subtitle, record.meta], query) &&
        recordMatchesFilters(record),
    )
  }, [activePage, query, recordMatchesFilters])
  const shortcuts = React.useMemo(
    () => getPageShortcuts(activePage, selectedRecord),
    [activePage, selectedRecord],
  )

  function pushActivity(label: string) {
    setActivityLog((current) => [
      { id: nextLocalId(), label, time: formatActivityTime() },
      ...current,
    ].slice(0, 6))
  }

  function openRecord(record: RecordCard | null) {
    setSelectedRecord(record)
    if (record) {
      pushActivity(`查看 ${record.title}`)
    }
  }

  function runShortcut(shortcut: DemoShortcut) {
    switch (shortcut.kind) {
      case 'navigate':
        if (shortcut.page) {
          setActivePage(shortcut.page)
          setSelectedRecord(null)
          openNotice(`已打开 ${areaMeta[shortcut.page].title}`)
        }
        break
      case 'search':
        setQuery(shortcut.query ?? '')
        openNotice(`已筛选 ${shortcut.query ?? ''}`)
        break
      case 'open-record':
        if (shortcut.record) {
          openRecord(shortcut.record)
          openNotice(`已打开 ${shortcut.record.title}`)
        }
        break
      case 'notice':
        openNotice(shortcut.notice ?? shortcut.label)
        break
      case 'toggle-customize':
        setCustomizing((value) => !value)
        openNotice(demoCopy.customize)
        break
      case 'toggle-language':
        toggleLanguage()
        break
      case 'cycle-organization':
        cycleOrganization()
        break
    }
  }

  function openNotice(label: string) {
    pushActivity(label)
    setNotice(actionMessage(label))
  }

  function cycleOrganization() {
    setOrganization((value) =>
      value === demoCopy.organization ? demoCopy.organizationAlt : demoCopy.organization,
    )
    setNotice(actionMessage('已切换组织'))
  }

  function toggleLanguage() {
    setLanguage((value) => (value === '中文' ? 'EN' : '中文'))
    setNotice(actionMessage('已切换语言'))
  }

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-20 shrink-0 border-r bg-rail lg:flex lg:flex-col lg:items-center">
        <div className="flex h-12 w-full items-center justify-center border-b">
          <IconButton variant="ghost" aria-label="Toggle app rail">
            <Menu className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
        <div className="flex w-full flex-1 flex-col gap-2 overflow-hidden px-2 py-3">
          <Button type="button" variant="secondary" className="h-8 w-full justify-center px-2">
            <Sparkles className="size-4" aria-hidden="true" />
          </Button>
          {railApps.map((app) => (
            <Button
              key={app.title}
              type="button"
              variant={app.title === 'Helios' ? 'secondary' : 'ghost'}
              className={cn(
                'h-7 w-full justify-start gap-1 px-2 text-xs font-medium',
                app.title !== 'Helios' && 'text-muted-foreground',
              )}
              onClick={() => openNotice(`打开 ${app.title}`)}
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  app.tone === 'success' && 'bg-status-success-icon',
                  app.tone === 'warning' && 'bg-status-warning-icon',
                  app.tone === 'error' && 'bg-status-error-icon',
                  app.tone === 'info' && 'bg-status-info-icon',
                  app.tone === 'neutral' && 'bg-muted-foreground',
                )}
                aria-hidden="true"
              />
              <span className="truncate">{app.title}</span>
            </Button>
          ))}
        </div>
        <div className="w-full border-t p-2">
              <Button type="button" variant="secondary" className="h-8 w-full justify-center px-2" onClick={() => openNotice('新增应用')}>
                <Plus className="size-4" aria-hidden="true" />
              </Button>
        </div>
      </aside>

      <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:block">
        <div className="flex h-12 items-center justify-between border-b px-4">
          <ProductMark compact />
          <IconButton variant="ghost" aria-label="Collapse sidebar">
            <PanelLeftClose className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
        <div className="space-y-5 p-4">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={demoCopy.searchPlaceholder}
            leftIcon={<Search className="size-4" aria-hidden="true" />}
            aria-label={demoCopy.topbarSearchLabel}
          />

          <nav className="space-y-5" aria-label="Backend navigation">
            {sidebarGroups.map((group) => (
              <section key={group.title} className="space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <p className="text-xs font-medium text-muted-foreground">{group.title}</p>
                  <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = activePage === item.id
                    return (
                      <Button
                        key={`${group.title}-${item.title}`}
                        type="button"
                        variant={isActive ? 'secondary' : 'ghost'}
                        className="h-9 w-full justify-start px-2 text-sm"
                        aria-pressed={isActive}
                        onClick={() => {
                          setActivePage(item.id)
                          setSelectedRecord(null)
                          openNotice(`已打开 ${item.title}`)
                        }}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        <span className="truncate">{item.title}</span>
                      </Button>
                    )
                  })}
                </div>
              </section>
            ))}
          </nav>
        </div>
      </aside>

      <section className={cn('flex min-w-0 flex-1 flex-col transition-[padding] duration-300', aiOpen && 'lg:pr-[420px]')}>
        <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b bg-background/95 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <IconButton variant="ghost" aria-label="Open menu">
              <Menu className="size-4" aria-hidden="true" />
            </IconButton>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Home className="size-4" aria-hidden="true" />
              <span>/</span>
              <span>{currentArea.title}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="hidden items-center gap-1 lg:flex">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="打开 AI 面板"
                onClick={() => setAiOpen((value) => !value)}
              >
                <AiIcon className="size-4" />
                AI
              </Button>
              <IconButton variant="ghost" aria-label="Search" onClick={() => openNotice('全局搜索')}>
                <Search className="size-4" aria-hidden="true" />
              </IconButton>
              <Button type="button" variant="outline" size="sm" onClick={cycleOrganization}>
                {organization}
                <ChevronDown className="size-4" aria-hidden="true" />
              </Button>
              <IconButton variant="ghost" aria-label="Settings" onClick={() => openNotice('系统设置')}>
                <Settings className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton variant="ghost" aria-label="Messages" onClick={() => openNotice('消息中心')}>
                <Mail className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton variant="ghost" aria-label="Notifications" onClick={() => openNotice('通知中心')}>
                <Bell className="size-4" aria-hidden="true" />
              </IconButton>
              <Button type="button" variant="outline" size="sm" onClick={toggleLanguage}>
                <Languages className="size-4" aria-hidden="true" />
                {language}
                <ChevronDown className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <IconButton variant="ghost" aria-label="Search" onClick={() => openNotice('全局搜索')}>
              <Search className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton variant="ghost" aria-label="Profile" onClick={() => openNotice('个人资料')}>
              <UserRound className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        </header>

        <div className="flex h-9 items-center border-b bg-card px-6 text-sm text-muted-foreground">
          <Home className="mr-2 size-4" aria-hidden="true" />
          <span>{demoCopy.localBadge}</span>
          {refreshCount > 0 ? (
            <Badge variant="success" dot className="ml-3">
              refreshed locally
            </Badge>
          ) : null}
        </div>

        <nav className="flex gap-2 overflow-x-auto border-b bg-sidebar px-4 py-2 md:hidden" aria-label="Mobile backend navigation">
          {sidebarGroups.flatMap((group) => group.items).map((item) => {
            const Icon = item.icon
            const isActive = activePage === item.id
            return (
              <Button
                key={`mobile-${item.id}`}
                type="button"
                variant={isActive ? 'secondary' : 'outline'}
                size="sm"
                className="shrink-0"
                aria-pressed={isActive}
                onClick={() => {
                  setActivePage(item.id)
                  setSelectedRecord(null)
                  openNotice(`已打开 ${item.title}`)
                }}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.title}
              </Button>
            )
          })}
        </nav>

        <section className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-6 py-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{currentArea.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{currentArea.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setRefreshCount((value) => value + 1)
                openNotice(demoCopy.refresh)
              }}>
                <RefreshCw className="size-4" aria-hidden="true" />
                {demoCopy.refresh}
              </Button>
              <Button type="button" variant={customizing ? 'secondary' : 'outline'} onClick={() => {
                setCustomizing((value) => !value)
                openNotice(demoCopy.customize)
              }}>
                <Settings className="size-4" aria-hidden="true" />
                {customizing ? demoCopy.customizeOn : demoCopy.customize}
              </Button>
              <Button type="button" variant="secondary" onClick={onReset}>
                <RotateCcw className="size-4" aria-hidden="true" />
                {demoCopy.resetLabel}
              </Button>
            </div>
          </div>

          {customizing ? (
            <div className="rounded-lg border border-status-info-border bg-status-info-bg p-4 text-sm text-status-info-text">
              <div className="flex items-start gap-3">
                <Settings className="mt-0.5 size-4 shrink-0 text-status-info-icon" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{demoCopy.customizeOn}</p>
                  <p className="mt-1">{demoCopy.customizeDescription}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border bg-card px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">当前上下文</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {query ? `筛选词：${query}` : '当前没有筛选词'}
                  {' · '}
                  {`状态：${filterLabel(statusFilter)}`}
                  {' · '}
                  {selectedRecord ? `选中：${selectedRecord.title}` : '未选中记录'}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {(query || statusFilter !== 'all') ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setQuery('')
                      setStatusFilter('all')
                      openNotice('清空筛选')
                    }}
                  >
                    清空筛选
                  </Button>
                ) : null}
                <ShortcutBar shortcuts={shortcuts.slice(0, 3)} onRun={runShortcut} />
              </div>
            </div>
            {activityLog.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                {activityLog.slice(0, 3).map((entry) => (
                  <Badge key={entry.id} variant="muted">
                    {entry.time} · {entry.label}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          {activePage !== 'dashboard' ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3">
              <span className="text-sm font-semibold">当前列表</span>
              <Badge variant="muted">{moduleRecords.length} 条记录</Badge>
              {query ? <Badge variant="info" dot>{query}</Badge> : null}
              {statusFilter !== 'all' ? (
                <StatusBadge variant={statusVariant(statusFilter)} dot>
                  {filterLabel(statusFilter)}
                </StatusBadge>
              ) : null}
            </div>
          ) : null}

          {activePage === 'dashboard' ? (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                {dashboardCards.map((card, index) => {
                  const records = index === 1 ? customers : index === 2 ? opportunities : []
                  return (
                    <Card key={card.title} className="min-h-96">
                      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                        <div>
                          <CardTitle className="text-sm">{card.title}</CardTitle>
                          <CardDescription className="mt-1 text-xs">{card.description}</CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                          <IconButton
                            variant="ghost"
                            size="sm"
                            aria-label={`${card.title} ${demoCopy.refresh}`}
                            onClick={() => openNotice(`${card.title} ${demoCopy.refresh}`)}
                          >
                            <RefreshCw className="size-4" aria-hidden="true" />
                          </IconButton>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (index === 0) setActivePage('customerTasks')
                              if (index === 1) setActivePage('company')
                              if (index === 2) setActivePage('quotes')
                              setSelectedRecord(null)
                              openNotice(`查看 ${card.title}`)
                            }}
                          >
                            查看全部
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {records.length === 0 ? (
                          <div className="flex h-64 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
                            {index === 0 ? demoCopy.emptyTask : '暂无匹配记录。'}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {records.map((record) => (
                              <button
                                key={record.id}
                                type="button"
                                className="w-full rounded-md border bg-background p-4 text-left transition hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => openRecord(record)}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">{record.title}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{record.subtitle}</p>
                                  </div>
                                  <p className="shrink-0 text-xs text-muted-foreground">{record.meta}</p>
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                  <StatusBadge variant={statusVariant(record.tone)} dot>
                                    {record.subtitle}
                                  </StatusBadge>
                                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                    查看
                                    <ArrowRight className="size-3.5" aria-hidden="true" />
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {metrics.map((metric, index) => (
                  <Card key={metric.label}>
                    <CardContent className="flex flex-col gap-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                          <p className="mt-2 text-3xl font-semibold">{metric.value}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{metric.detail}</p>
                        </div>
                        <StatusBadge variant={statusVariant(metric.tone)} dot>
                          {metric.label}
                        </StatusBadge>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit"
                        onClick={() => {
                          if (index === 0) setActivePage('operationalDashboard')
                          if (index === 1) setActivePage('orders')
                          if (index === 2) setActivePage('warehouse')
                          setSelectedRecord(null)
                          openNotice(`查看 ${metric.label}`)
                        }}
                      >
                        查看关联页面
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>Workflow coverage</CardTitle>
                      <CardDescription>Static workflow state mirrors the backend component density.</CardDescription>
                    </div>
                    <Badge variant="brand" dot>
                      {demoCopy.githubPagesNote}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-3">
                  {workflows.map((workflow, index) => {
                    const Icon = workflow.icon
                    return (
                      <button
                        key={workflow.id}
                        type="button"
                        className="rounded-md border bg-background p-4 text-left transition hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => {
                          if (index === 0) setActivePage('operationalDashboard')
                          if (index === 1) setActivePage('orders')
                          if (index === 2) setAiOpen(true)
                          if (index !== 2) setSelectedRecord(null)
                          openNotice(workflow.title)
                        }}
                      >
                        <div className="mb-4 flex items-start gap-3">
                          <span className="rounded-md bg-primary/10 p-2 text-primary">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold">{workflow.title}</p>
                            <p className="mt-1 text-sm leading-5 text-muted-foreground">{workflow.description}</p>
                          </div>
                        </div>
                        <Progress
                          value={workflow.progress}
                          tone={toneProgress[workflow.tone]}
                          showValue
                          label="Coverage"
                        />
                      </button>
                    )
                  })}
                </CardContent>
              </Card>
            </>
          ) : (
            <ModuleExperience
              title={currentArea.title}
              description={currentArea.description}
              empty={currentArea.empty}
              records={moduleRecords}
              shortcuts={shortcuts}
              selectedRecord={selectedRecord}
              statusFilter={statusFilter}
              onRunShortcut={runShortcut}
              onSetStatusFilter={(tone) => {
                setStatusFilter(tone)
                openNotice(`筛选 ${filterLabel(tone)}`)
              }}
              onOpenRecord={openRecord}
              onOpenNotice={openNotice}
            />
          )}
        </section>
      </section>

      <Button
        type="button"
        className="fixed bottom-6 right-6 z-30 shadow-lg"
        aria-label={aiOpen ? '收起 AI 面板' : '打开 AI 面板'}
        onClick={() => setAiOpen((value) => !value)}
      >
        <AiIcon className="size-4" />
        {aiOpen ? '收起 AI' : 'AI 助手'}
      </Button>

      <DemoAiDock
        open={aiOpen}
        onOpenChange={setAiOpen}
        activePage={activePage}
        organization={organization}
        language={language}
        query={query}
        customizing={customizing}
        selectedRecord={selectedRecord}
        onNavigate={(page) => {
          setActivePage(page)
          setSelectedRecord(null)
          pushActivity(`AI 打开 ${areaMeta[page].title}`)
        }}
        onSetQuery={(value) => {
          setQuery(value)
          openNotice(value ? `AI 筛选 ${value}` : 'AI 清空筛选')
        }}
        onOpenRecord={openRecord}
        onToggleCustomize={() => {
          setCustomizing((value) => !value)
          openNotice(demoCopy.customize)
        }}
        onCycleOrganization={cycleOrganization}
        onToggleLanguage={toggleLanguage}
        onOpenNotice={openNotice}
      />

      {selectedRecord ? (
        <RecordInspector
          record={selectedRecord}
          organization={organization}
          aiOpen={aiOpen}
          onClose={() => setSelectedRecord(null)}
          onFollow={() => {
            openNotice(`${selectedRecord.title} 已加入跟进`)
            setSelectedRecord(null)
          }}
          onAskAi={() => {
            setAiOpen(true)
            openNotice(`AI 查看 ${selectedRecord.title}`)
          }}
        />
      ) : null}

      {notice.length > 0 ? (
        <div className="pointer-events-none fixed bottom-6 left-6 z-50 w-full max-w-sm px-4" role="status" aria-live="polite">
          <div className="pointer-events-auto rounded-xl border bg-card p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-status-info-bg text-status-info-icon">
                <Sparkles className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">{demoCopy.githubPagesNote}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{notice}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={() => setNotice('')}>
                知道了
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export function DemoWorkspace() {
  const [screen, setScreen] = React.useState<'intro' | 'start' | 'backend'>('intro')

  if (screen === 'backend') {
    return <BackendExperience onReset={() => setScreen('start')} />
  }

  if (screen === 'intro') {
    return <DemoIntro onFinish={() => setScreen('start')} />
  }

  return <StartExperience onEnter={() => setScreen('backend')} />
}
