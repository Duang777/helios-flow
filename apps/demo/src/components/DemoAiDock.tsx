'use client'

import * as React from 'react'
import {
  ArrowRight,
  Clock3,
  Compass,
  Globe2,
  LayoutDashboard,
  Layers3,
  ListTodo,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Warehouse,
  Waypoints,
} from 'lucide-react'

import { AiIcon } from '@helios/ui/ai'
import { Badge } from '@helios/ui/primitives/badge'
import { Button } from '@helios/ui/primitives/button'
import { IconButton } from '@helios/ui/primitives/icon-button'
import { Input } from '@helios/ui/primitives/input'
import { ScrollArea } from '@helios/ui/primitives/scroll-area'
import { cn } from '@helios/shared/lib/utils'

import { areaMeta, pageContent, type DemoArea, type RecordCard } from '@/lib/demo-data'
import {
  findRecordMatches,
  getPageShortcuts,
  type DemoShortcut,
} from '@/lib/demo-interactions'

type AiTab = 'chat' | 'actions' | 'trace'

type AiMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  chips?: Array<{
    label: string
    description: string
    onClick: () => void
  }>
}

type TraceEntry = {
  id: string
  title: string
  detail: string
  tone: 'success' | 'warning' | 'info' | 'neutral'
}

interface DemoAiDockProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  activePage: DemoArea
  organization: string
  language: string
  query: string
  customizing: boolean
  selectedRecord: RecordCard | null
  onNavigate: (page: DemoArea) => void
  onSetQuery: (value: string) => void
  onOpenRecord: (record: RecordCard | null) => void
  onToggleCustomize: () => void
  onCycleOrganization: () => void
  onToggleLanguage: () => void
  onOpenNotice: (label: string) => void
}

const dockPages: DemoArea[] = [
  'dashboard',
  'company',
  'calendar',
  'customerTasks',
  'contacts',
  'products',
  'categories',
  'createSalesDoc',
  'quotes',
  'orders',
  'salesChannels',
  'operationalDashboard',
  'warehouse',
  'shipping',
]

function nextId() {
  return Math.random().toString(36).slice(2, 10)
}

function countRecords() {
  return Object.values(pageContent).reduce((sum, page) => sum + page.records.length, 0)
}

function resolvePageFromPrompt(prompt: string): DemoArea | null {
  const normalized = prompt.trim().toLowerCase()
  if (!normalized) return null
  if (normalized.includes('仪表盘') || normalized.includes('总览') || normalized.includes('dashboard')) return 'dashboard'
  if (normalized.includes('公司') || normalized.includes('组织') || normalized.includes('company')) return 'company'
  if (normalized.includes('历法') || normalized.includes('日程') || normalized.includes('会议') || normalized.includes('calendar')) return 'calendar'
  if (normalized.includes('任务') || normalized.includes('todo') || normalized.includes('task')) return 'customerTasks'
  if (normalized.includes('联系人') || normalized.includes('contact')) return 'contacts'
  if (normalized.includes('产品') || normalized.includes('服务') || normalized.includes('product')) return 'products'
  if (normalized.includes('分类') || normalized.includes('category')) return 'categories'
  if (normalized.includes('报价') || normalized.includes('quote')) return 'quotes'
  if (normalized.includes('订单') || normalized.includes('order')) return 'orders'
  if (normalized.includes('渠道') || normalized.includes('channel')) return 'salesChannels'
  if (normalized.includes('仓库') || normalized.includes('库存') || normalized.includes('warehouse')) return 'warehouse'
  if (normalized.includes('发货') || normalized.includes('shipping')) return 'shipping'
  if (normalized.includes('单据') || normalized.includes('合同') || normalized.includes('salesdoc')) return 'createSalesDoc'
  if (normalized.includes('操作') || normalized.includes('automation') || normalized.includes('ops')) return 'operationalDashboard'
  return null
}

function makeSummary(page: DemoArea) {
  const total = countRecords()
  if (page === 'dashboard') {
    const riskPages = ['warehouse', 'orders', 'quotes']
    return `我已连接四维图新公司全平台，当前共 ${total} 条模拟记录，重点风险集中在 ${riskPages.map((key) => areaMeta[key as Exclude<DemoArea, 'dashboard'>].title).join('、')}。`
  }
  const pageRecordCount = pageContent[page]?.records.length ?? 0
  return `我已切到「${areaMeta[page].title}」，这里有 ${pageRecordCount} 条可操作记录。`
}

function firstActionableShortcut(page: DemoArea, selectedRecord: RecordCard | null) {
  return getPageShortcuts(page, selectedRecord).find((shortcut) => shortcut.kind !== 'notice') ?? null
}

export function DemoAiDock({
  open,
  onOpenChange,
  activePage,
  organization,
  language,
  query,
  customizing,
  selectedRecord,
  onNavigate,
  onSetQuery,
  onOpenRecord,
  onToggleCustomize,
  onCycleOrganization,
  onToggleLanguage,
  onOpenNotice,
}: DemoAiDockProps) {
  const [tab, setTab] = React.useState<AiTab>('chat')
  const [input, setInput] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [messages, setMessages] = React.useState<AiMessage[]>([
    {
      id: nextId(),
      role: 'assistant',
      text: '我已经接入四维图新公司全平台。你可以让我切页、搜记录、生成摘要、或者直接帮你打开风险项。',
      chips: [
        {
          label: '看全局摘要',
          description: '统计全部模块和风险点',
          onClick: () => runPrompt('生成全局摘要'),
        },
        {
          label: '去仓库页',
          description: '查看缺货预警和调拨',
          onClick: () => runPrompt('切到仓库'),
        },
        {
          label: '打开订单',
          description: '查看待发货与回款',
          onClick: () => runPrompt('切到订单'),
        },
      ],
    },
  ])
  const [trace, setTrace] = React.useState<TraceEntry[]>([
    {
      id: nextId(),
      title: '已连接平台',
      detail: `当前共 ${countRecords()} 条模拟记录`,
      tone: 'success',
    },
  ])
  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  const globalSummary = React.useMemo(() => makeSummary(activePage), [activePage])
  const currentPageSummary = activePage === 'dashboard' ? areaMeta.dashboard : pageContent[activePage]
  const recentPages = dockPages.filter((page) => page !== activePage).slice(0, 4)
  const activeRecordCount = activePage === 'dashboard' ? countRecords() : pageContent[activePage].records.length
  const hotPages: Array<{ page: DemoArea; label: string; detail: string }> = [
    { page: 'warehouse', label: '仓库', detail: '缺货预警和调拨' },
    { page: 'orders', label: '订单', detail: '待发货和回款' },
    { page: 'quotes', label: '报价', detail: '审批状态和签署' },
    { page: 'customerTasks', label: '客户任务', detail: '协同与跟进' },
  ]
  const contextualShortcuts = React.useMemo(
    () => getPageShortcuts(activePage, selectedRecord).slice(0, 4),
    [activePage, selectedRecord],
  )

  React.useEffect(() => {
    if (!open) return
    setTrace((current) => [
      {
        id: nextId(),
        title: `查看 ${currentPageSummary.title}`,
        detail: currentPageSummary.description,
        tone: 'info' as const,
      },
      ...current,
    ].slice(0, 8))
  }, [open, currentPageSummary.description, currentPageSummary.title])

  React.useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, tab])

  function pushTrace(title: string, detail: string, tone: TraceEntry['tone'] = 'info') {
    setTrace((current) => [{ id: nextId(), title, detail, tone }, ...current].slice(0, 8))
  }

  function openPage(page: DemoArea) {
    onNavigate(page)
    pushTrace('切换页面', areaMeta[page].title, 'success')
  }

  function setFilter(value: string) {
    onSetQuery(value)
    pushTrace('设置筛选', value || '清空筛选', value ? 'success' : 'neutral')
  }

  function openDemoRecord(record: RecordCard) {
    onOpenRecord(record)
    pushTrace('打开记录', record.title, 'success')
  }

  function fireNotice(label: string) {
    onOpenNotice(label)
    pushTrace('触发操作', label, 'info')
  }

  function runShortcut(shortcut: DemoShortcut) {
    switch (shortcut.kind) {
      case 'navigate':
        if (shortcut.page) openPage(shortcut.page)
        break
      case 'search':
        setFilter(shortcut.query ?? '')
        break
      case 'open-record':
        if (shortcut.record) openDemoRecord(shortcut.record)
        break
      case 'notice':
        fireNotice(shortcut.notice ?? shortcut.label)
        break
      case 'toggle-customize':
        onToggleCustomize()
        pushTrace('切换个性化', customizing ? '关闭' : '开启', 'success')
        break
      case 'toggle-language':
        onToggleLanguage()
        pushTrace('切换语言', language === '中文' ? 'EN' : '中文', 'success')
        break
      case 'cycle-organization':
        onCycleOrganization()
        pushTrace('切换组织', organization, 'success')
        break
    }
  }

  function injectAssistant(text: string, chips?: AiMessage['chips']) {
    setMessages((current) => [
      ...current,
      { id: nextId(), role: 'assistant', text, chips },
    ])
  }

  function runPrompt(prompt: string) {
    const trimmed = prompt.trim()
    if (!trimmed || busy) return
    setInput('')
    setBusy(true)
    setMessages((current) => [...current, { id: nextId(), role: 'user', text: trimmed }])
    pushTrace('收到指令', trimmed, 'info')

    window.setTimeout(() => {
      const matchedPage = resolvePageFromPrompt(trimmed)
      const lower = trimmed.toLowerCase()
      const recordMatches = findRecordMatches(trimmed).slice(0, 3)
      const chips: AiMessage['chips'] = []
      const actedOn: string[] = []
      const summary = makeSummary(matchedPage ?? activePage)
      let response = summary

      if (/搜索|筛选|找|查/.test(trimmed)) {
        const keyword = trimmed
          .replace(/.*?(搜索|筛选|找|查)/, '')
          .trim()
          .replace(/^[:：]/, '')
        if (keyword) {
          setFilter(keyword)
          actedOn.push(`筛选「${keyword}」`)
          chips.push({
            label: `搜索「${keyword}」`,
            description: '已同步到全平台筛选',
            onClick: () => setFilter(keyword),
          })
          response = `我已经把全平台搜索词设为「${keyword}」。`
        }
      }

      if (matchedPage) {
        openPage(matchedPage)
        actedOn.push(`切到 ${areaMeta[matchedPage].title}`)
        chips.push({
          label: `打开 ${areaMeta[matchedPage].title}`,
          description: '切到对应模块',
          onClick: () => openPage(matchedPage),
        })
        response = `${summary} 我已切到 ${areaMeta[matchedPage].title}。`
      }

      if (/组织|公司/.test(trimmed) && !matchedPage) {
        onCycleOrganization()
        actedOn.push('切换组织')
        chips.push({
          label: '切换组织',
          description: '在四维图新公司语境下轮换组织',
          onClick: () => runShortcut({ id: 'tmp-org', label: '切换组织', description: '切换组织', kind: 'cycle-organization' }),
        })
        response = '我已帮你切换当前组织。'
      }

      if (/语言|english|en/.test(lower)) {
        onToggleLanguage()
        actedOn.push('切换语言')
        chips.push({
          label: '切换语言',
          description: '切换中文 / EN',
          onClick: () => runShortcut({ id: 'tmp-lang', label: '切换语言', description: '切换语言', kind: 'toggle-language' }),
        })
        response = '我已帮你切换语言。'
      }

      if (/自定义|布局/.test(trimmed)) {
        onToggleCustomize()
        actedOn.push('切换个性化')
        chips.push({
          label: '切换自定义',
          description: '打开或关闭个性化模式',
          onClick: () => runShortcut({ id: 'tmp-customize', label: '切换自定义', description: '切换自定义', kind: 'toggle-customize' }),
        })
        response = '我已切换个性化布局状态。'
      }

      const nextRecordMatch = recordMatches[0] ?? (selectedRecord ? { page: activePage, record: selectedRecord } : null)
      if (/(第一条|首条|详情|记录|打开)/.test(trimmed) && nextRecordMatch) {
        if (nextRecordMatch.page !== activePage) {
          openPage(nextRecordMatch.page)
          actedOn.push(`切到 ${areaMeta[nextRecordMatch.page].title}`)
        }
        openDemoRecord(nextRecordMatch.record)
        actedOn.push(`打开 ${nextRecordMatch.record.title}`)
        chips.push({
          label: `打开 ${nextRecordMatch.record.title}`,
          description: `查看 ${nextRecordMatch.record.subtitle}`,
          onClick: () => openDemoRecord(nextRecordMatch.record),
        })
        response = `我已经打开 ${nextRecordMatch.record.title} 的详情。`
      } else if (recordMatches.length > 1) {
        recordMatches.forEach((match) => {
          chips.push({
            label: `去 ${match.record.title}`,
            description: `在 ${areaMeta[match.page].title} 中打开`,
            onClick: () => {
              openPage(match.page)
              openDemoRecord(match.record)
            },
          })
        })
      }

      if (/\b摘要\b|总结|概览|全局/.test(trimmed)) {
        chips.push({
          label: '看仓库',
          description: '优先处理缺货',
          onClick: () => openPage('warehouse'),
        })
        chips.push({
          label: '看订单',
          description: '查看待发货和回款',
          onClick: () => openPage('orders'),
        })
        chips.push({
          label: '看报价',
          description: '查看审批中的报价',
          onClick: () => openPage('quotes'),
        })
        response = globalSummary
      }

      if (/联系|support|客服/.test(trimmed)) {
        fireNotice('联系支持')
        actedOn.push('联系支持')
        chips.push({
          label: '联系支持',
          description: '打开本地联系入口',
          onClick: () => fireNotice('联系支持'),
        })
        response = '我帮你打开了联系支持入口。'
      }

      if (chips.length === 0) {
        const fallback = firstActionableShortcut(matchedPage ?? activePage, selectedRecord)
        if (fallback) {
          chips.push({
            label: fallback.label,
            description: fallback.description,
            onClick: () => runShortcut(fallback),
          })
        }
        chips.push(
          {
            label: '去仓库',
            description: '查库存风险',
            onClick: () => openPage('warehouse'),
          },
          {
            label: '去订单',
            description: '看履约状态',
            onClick: () => openPage('orders'),
          },
        )
      }

      injectAssistant(response, chips)
      pushTrace(
        'AI 处理完成',
        actedOn.length > 0 ? actedOn.join(' · ') : trimmed,
        matchedPage || recordMatches.length > 0 ? 'success' : 'info',
      )
      setBusy(false)
    }, 550)
  }

  function runQuickAction(label: string, fn: () => void) {
    fn()
    pushTrace(label, '已同步到平台状态', 'success')
    onOpenNotice(label)
  }

  return (
    <aside
      className={cn(
        'fixed right-0 top-24 z-40 h-[calc(100vh-6rem)] w-[420px] max-w-[calc(100vw-1rem)] border-l bg-background shadow-2xl transition-transform duration-300',
        open ? 'translate-x-0' : 'pointer-events-none translate-x-full',
      )}
      aria-hidden={!open}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between border-b px-4 py-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent-indigo/10 text-accent-indigo">
              <AiIcon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Helios AI</p>
              <p className="text-xs text-muted-foreground">已连接四维图新公司全平台</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <IconButton variant="ghost" aria-label="关闭 AI 面板" onClick={() => onOpenChange(false)}>
              <ArrowRight className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        </div>

        <div className="border-b px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted" dot>
              {areaMeta[activePage].title}
            </Badge>
            <Badge variant="muted" dot>
              {organization}
            </Badge>
            <Badge variant="muted" dot>
              {query ? `筛选: ${query}` : '全平台未筛选'}
            </Badge>
            <Badge variant="muted" dot>
              {selectedRecord ? `记录: ${selectedRecord.title}` : '未选记录'}
            </Badge>
            <Badge variant={customizing ? 'info' : 'neutral'} dot>
              {customizing ? '自定义中' : '浏览模式'}
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{globalSummary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {contextualShortcuts.map((shortcut) => (
              <Button
                key={shortcut.id}
                type="button"
                variant="outline"
                size="sm"
                title={shortcut.description}
                onClick={() => runShortcut(shortcut)}
              >
                {shortcut.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 border-b px-4 py-2">
          {(['chat', 'actions', 'trace'] as AiTab[]).map((value) => (
            <Button
              key={value}
              type="button"
              variant={tab === value ? 'secondary' : 'ghost'}
              size="sm"
              className="capitalize"
              onClick={() => setTab(value)}
            >
              {value === 'chat' ? '对话' : value === 'actions' ? '行动' : '轨迹'}
            </Button>
          ))}
        </div>

        <div className="min-h-0 flex-1">
          {tab === 'chat' ? (
            <div className="flex h-full min-h-0 flex-col">
              <ScrollArea className="min-h-0 flex-1 px-4 py-4">
                <div ref={scrollRef} className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-6 shadow-xs',
                          message.role === 'user'
                            ? 'border-primary/20 bg-primary text-primary-foreground'
                            : 'border-border bg-card',
                        )}
                      >
                        <p>{message.text}</p>
                        {message.chips?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {message.chips.map((chip) => (
                              <button
                                key={chip.label}
                                type="button"
                                className={cn(
                                  'rounded-full border px-3 py-1 text-xs transition-colors',
                                  message.role === 'user'
                                    ? 'border-primary-foreground/30 text-primary-foreground/90 hover:bg-primary-foreground/10'
                                    : 'border-border bg-background hover:bg-muted',
                                )}
                                onClick={chip.onClick}
                              >
                                <span className="font-medium">{chip.label}</span>
                                <span className="ml-2 text-[10px] opacity-70">{chip.description}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {busy ? (
                    <div className="flex justify-start">
                      <div className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <span className="size-2 animate-pulse rounded-full bg-accent-indigo" />
                          AI 正在连接全平台状态...
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </ScrollArea>

              <div className="border-t px-4 py-4">
                <div className="space-y-2">
                  <Input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="问我：切到仓库看缺货 / 总结全平台 / 打开首条记录"
                    leftIcon={<Search className="size-4" aria-hidden="true" />}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        runPrompt(input)
                      }
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => runPrompt(input)}>
                      发送
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => runPrompt('生成全局摘要')}>
                      生成摘要
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => runPrompt('切到仓库')}>
                      看仓库
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'actions' ? (
            <ScrollArea className="h-full px-4 py-4">
              <div className="space-y-4">
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">当前页面动作</h3>
                    <Badge variant="muted">实时</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {contextualShortcuts.map((shortcut) => (
                      <Button
                        key={`actions-${shortcut.id}`}
                        type="button"
                        variant="secondary"
                        size="sm"
                        title={shortcut.description}
                        onClick={() => runShortcut(shortcut)}
                      >
                        {shortcut.label}
                      </Button>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">全平台动作</h3>
                    <Badge variant="muted">实时</Badge>
                  </div>
                  <div className="grid gap-2">
                    <Button type="button" variant="outline" className="justify-start" onClick={() => runQuickAction('打开仪表盘', () => onNavigate('dashboard'))}>
                      <LayoutDashboard className="size-4" aria-hidden="true" />
                      打开仪表盘
                    </Button>
                    <Button type="button" variant="outline" className="justify-start" onClick={() => runQuickAction('查看仓库预警', () => onNavigate('warehouse'))}>
                      <Warehouse className="size-4" aria-hidden="true" />
                      查看仓库预警
                    </Button>
                    <Button type="button" variant="outline" className="justify-start" onClick={() => runQuickAction('查看订单风险', () => onNavigate('orders'))}>
                      <Waypoints className="size-4" aria-hidden="true" />
                      查看订单风险
                    </Button>
                    <Button type="button" variant="outline" className="justify-start" onClick={() => runQuickAction('切换组织', onCycleOrganization)}>
                      <Globe2 className="size-4" aria-hidden="true" />
                      切换组织
                    </Button>
                    <Button type="button" variant="outline" className="justify-start" onClick={() => runQuickAction('切换语言', onToggleLanguage)}>
                      <Compass className="size-4" aria-hidden="true" />
                      切换语言
                    </Button>
                    <Button type="button" variant="outline" className="justify-start" onClick={() => runQuickAction('个性化布局', onToggleCustomize)}>
                      <Settings2 className="size-4" aria-hidden="true" />
                      个性化布局
                    </Button>
                    <Button type="button" variant="outline" className="justify-start" onClick={() => runQuickAction('打开客户任务', () => onNavigate('customerTasks'))}>
                      <ListTodo className="size-4" aria-hidden="true" />
                      打开客户任务
                    </Button>
                    <Button type="button" variant="outline" className="justify-start" onClick={() => runQuickAction('联系支持', () => onOpenNotice('联系支持'))}>
                      <Sparkles className="size-4" aria-hidden="true" />
                      联系支持
                    </Button>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">最近建议</h3>
                    <Badge variant="muted">{activeRecordCount} 条</Badge>
                  </div>
                  <div className="space-y-2">
                    {hotPages.map((entry) => (
                      <div key={entry.page} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{entry.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{entry.detail}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => runQuickAction(`打开 ${entry.label}`, () => onNavigate(entry.page))}
                          >
                            打开
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </ScrollArea>
          ) : null}

          {tab === 'trace' ? (
            <ScrollArea className="h-full px-4 py-4">
              <div className="space-y-4">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">平台上下文</h3>
                  <div className="grid gap-2 text-sm">
                      <div className="rounded-lg border bg-card p-3">
                      <p className="text-xs text-muted-foreground">当前页面</p>
                      <p className="mt-1 font-medium">{currentPageSummary.title}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-xs text-muted-foreground">组织</p>
                      <p className="mt-1 font-medium">{organization}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-xs text-muted-foreground">筛选词</p>
                      <p className="mt-1 font-medium">{query || '无'}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-xs text-muted-foreground">选中记录</p>
                      <p className="mt-1 font-medium">{selectedRecord?.title ?? '无'}</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">最近轨迹</h3>
                    <Badge variant="muted">{trace.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {trace.map((entry) => (
                      <div key={entry.id} className="rounded-lg border bg-card p-3">
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              'mt-0.5 size-2 rounded-full',
                              entry.tone === 'success' && 'bg-status-success-icon',
                              entry.tone === 'warning' && 'bg-status-warning-icon',
                              entry.tone === 'info' && 'bg-status-info-icon',
                              entry.tone === 'neutral' && 'bg-muted-foreground',
                            )}
                            aria-hidden="true"
                          />
                          <div>
                            <p className="text-sm font-medium">{entry.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{entry.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">最近可去页面</h3>
                  <div className="grid gap-2">
                    {recentPages.map((page) => (
                      <Button key={page} type="button" variant="outline" className="justify-between" onClick={() => onNavigate(page)}>
                        <span>{areaMeta[page].title}</span>
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Button>
                    ))}
                  </div>
                </section>
              </div>
            </ScrollArea>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
