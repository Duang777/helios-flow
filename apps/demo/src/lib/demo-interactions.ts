import { areaMeta, pageContent, type DemoArea, type RecordCard } from '@/lib/demo-data'

export type DemoShortcutKind =
  | 'navigate'
  | 'search'
  | 'open-record'
  | 'notice'
  | 'toggle-customize'
  | 'toggle-language'
  | 'cycle-organization'

export type DemoShortcut = {
  id: string
  label: string
  description: string
  kind: DemoShortcutKind
  page?: DemoArea
  query?: string
  notice?: string
  record?: RecordCard
}

export type RecordMatch = {
  page: DemoArea
  record: RecordCard
}

const orderedPages: DemoArea[] = [
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

function firstRecord(page: DemoArea) {
  return page === 'dashboard' ? null : pageContent[page]?.records[0] ?? null
}

function recordByTitle(page: DemoArea, pattern: string) {
  if (page === 'dashboard') return null
  return (
    pageContent[page].records.find((record) => record.title.includes(pattern)) ??
    firstRecord(page)
  )
}

export function getPageShortcuts(
  page: DemoArea,
  selectedRecord: RecordCard | null = null,
): DemoShortcut[] {
  const record = selectedRecord ?? firstRecord(page)

  switch (page) {
    case 'dashboard':
      return [
        {
          id: 'dashboard-summary',
          label: '全局摘要',
          description: '查看当前平台的整体概览',
          kind: 'notice',
          notice: '已生成当前平台的全局摘要',
        },
        {
          id: 'dashboard-warehouse',
          label: '去仓库',
          description: '关注库存与缺货',
          kind: 'navigate',
          page: 'warehouse',
        },
        {
          id: 'dashboard-orders',
          label: '去订单',
          description: '查看履约与回款',
          kind: 'navigate',
          page: 'orders',
        },
        {
          id: 'dashboard-first-record',
          label: '打开首条',
          description: '打开当前页的第一条可视记录',
          kind: 'open-record',
          record: record ?? undefined,
        },
      ]
    case 'company':
      return [
        {
          id: 'company-cycle',
          label: '切换组织',
          description: '轮换四维图新公司的组织视角',
          kind: 'cycle-organization',
        },
        {
          id: 'company-search',
          label: '搜事业群',
          description: '过滤事业群和公司档案',
          kind: 'search',
          query: '事业群',
        },
        {
          id: 'company-open',
          label: '打开档案',
          description: '打开当前页的首条公司记录',
          kind: 'open-record',
          record: record ?? undefined,
        },
      ]
    case 'calendar':
      return [
        {
          id: 'calendar-search',
          label: '搜会议',
          description: '查看会议和日程',
          kind: 'search',
          query: '会议',
        },
        {
          id: 'calendar-open',
          label: '打开日程',
          description: '打开第一条日程记录',
          kind: 'open-record',
          record: record ?? undefined,
        },
      ]
    case 'customerTasks':
      return [
        {
          id: 'tasks-search',
          label: '看待处理',
          description: '过滤待处理和进行中任务',
          kind: 'search',
          query: '待',
        },
        {
          id: 'tasks-open',
          label: '打开任务',
          description: '打开第一条任务',
          kind: 'open-record',
          record: record ?? undefined,
        },
        {
          id: 'tasks-notice',
          label: '发起跟进',
          description: '模拟创建跟进提醒',
          kind: 'notice',
          notice: '已创建客户跟进提醒',
        },
      ]
    case 'contacts':
      return [
        {
          id: 'contacts-search',
          label: '搜负责人',
          description: '过滤项目负责人和客户经理',
          kind: 'search',
          query: '项目',
        },
        {
          id: 'contacts-open',
          label: '打开联系人',
          description: '打开第一条联系人',
          kind: 'open-record',
          record: record ?? undefined,
        },
      ]
    case 'products':
      return [
        {
          id: 'products-search',
          label: '搜地图',
          description: '过滤产品与服务',
          kind: 'search',
          query: '地图',
        },
        {
          id: 'products-open',
          label: '打开产品',
          description: '打开第一条产品记录',
          kind: 'open-record',
          record: record ?? undefined,
        },
      ]
    case 'categories':
      return [
        {
          id: 'categories-search',
          label: '搜车路云',
          description: '过滤能力分类',
          kind: 'search',
          query: '车路云',
        },
        {
          id: 'categories-open',
          label: '打开分类',
          description: '打开第一条分类记录',
          kind: 'open-record',
          record: record ?? undefined,
        },
      ]
    case 'createSalesDoc':
      return [
        {
          id: 'salesdoc-search',
          label: '看模板',
          description: '查看销售单据模板',
          kind: 'search',
          query: '模板',
        },
        {
          id: 'salesdoc-open',
          label: '打开单据',
          description: '打开第一条单据草稿',
          kind: 'open-record',
          record: record ?? undefined,
        },
      ]
    case 'quotes':
      return [
        {
          id: 'quotes-search',
          label: '看审批',
          description: '过滤审批和待确认报价',
          kind: 'search',
          query: '审批',
        },
        {
          id: 'quotes-open',
          label: '打开报价',
          description: '打开第一条报价',
          kind: 'open-record',
          record: record ?? undefined,
        },
      ]
    case 'orders':
      return [
        {
          id: 'orders-search',
          label: '看发货',
          description: '过滤履约和待发货订单',
          kind: 'search',
          query: '待发货',
        },
        {
          id: 'orders-open',
          label: '打开订单',
          description: '打开第一条订单',
          kind: 'open-record',
          record: record ?? undefined,
        },
      ]
    case 'salesChannels':
      return [
        {
          id: 'channels-search',
          label: '看渠道',
          description: '过滤渠道和合作伙伴',
          kind: 'search',
          query: '渠道',
        },
        {
          id: 'channels-open',
          label: '打开渠道',
          description: '打开第一条渠道记录',
          kind: 'open-record',
          record: record ?? undefined,
        },
      ]
    case 'operationalDashboard':
      return [
        {
          id: 'ops-notice',
          label: '同步状态',
          description: '模拟执行平台同步',
          kind: 'notice',
          notice: '已同步 Helios 运行状态',
        },
        {
          id: 'ops-open',
          label: '打开队列',
          description: '打开第一条运维记录',
          kind: 'open-record',
          record: record ?? undefined,
        },
      ]
    case 'warehouse':
      return [
        {
          id: 'warehouse-search',
          label: '看缺货',
          description: '过滤库存与缺货预警',
          kind: 'search',
          query: '缺货',
        },
        {
          id: 'warehouse-beijing',
          label: '北京仓',
          description: '打开北京仓库存',
          kind: 'open-record',
          record: recordByTitle(page, '北京仓') ?? record ?? undefined,
        },
        {
          id: 'warehouse-shanghai',
          label: '上海仓',
          description: '打开上海仓缺货预警',
          kind: 'open-record',
          record: recordByTitle(page, '上海仓') ?? record ?? undefined,
        },
      ]
    case 'shipping':
      return [
        {
          id: 'shipping-search',
          label: '看发货',
          description: '过滤运输和签收状态',
          kind: 'search',
          query: '发货',
        },
        {
          id: 'shipping-open',
          label: '打开发运',
          description: '打开第一条发货记录',
          kind: 'open-record',
          record: record ?? undefined,
        },
      ]
  }
}

export function findRecordMatches(prompt: string): RecordMatch[] {
  const normalized = prompt.trim().toLowerCase()
  if (!normalized) return []

  return orderedPages.flatMap((page) =>
    page === 'dashboard'
      ? []
      : pageContent[page].records
          .filter((record) => {
            const searchable = [record.title, record.subtitle, record.meta].join(' ').toLowerCase()
            return normalized.includes(searchable) || searchable.includes(normalized)
          })
          .map((record) => ({ page, record })),
  )
}

export function findRecordMatchByKeyword(keyword: string): RecordMatch | null {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) return null

  for (const page of orderedPages) {
    if (page === 'dashboard') continue
    const match = pageContent[page].records.find((record) => {
      const searchable = [record.title, record.subtitle, record.meta].join(' ').toLowerCase()
      return searchable.includes(normalized) || normalized.includes(searchable)
    })
    if (match) {
      return { page, record: match }
    }
  }

  return null
}

export function getPageSuggestion(page: DemoArea) {
  return areaMeta[page].description
}
