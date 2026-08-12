import { readFileSync } from 'node:fs'

export const DEFAULT_VIEWPORT = { width: 1920, height: 1080 }
export const DEFAULT_SCENE_DURATION_MS = 8_000

export const COMPETITION_SCENES = [
  {
    id: '01-login-home',
    moduleId: 'shell',
    path: '/backend',
    titleZh: '登录首页与中文工作台',
    titleEn: 'Login Home And Chinese Workspace',
    subtitleZh: '登录后进入思维图新经营工作台，左侧模块、组织切换和通知入口全部服务真实业务数据。',
    subtitleEn: 'After sign-in, the NavInfo operating workspace opens with real modules, organization switching, and notification entry points.',
    action: 'overview',
  },
  {
    id: '02-today-digest',
    moduleId: 'insights',
    path: '/backend/insights/operating-loop/today',
    titleZh: '今日经营摘要',
    titleEn: 'Today Operating Digest',
    subtitleZh: '今日摘要把 critical 检出、逾期应收、延期项目和 KPI 缺口按组汇总，并提供源记录跳转。',
    subtitleEn: 'The daily digest groups critical findings, overdue receivables, delayed projects, and KPI gaps with links to source records.',
    action: 'scroll',
  },
  {
    id: '03-projects',
    moduleId: 'projects',
    path: '/backend/projects',
    titleZh: '项目进度与延期风险',
    titleEn: 'Project Delivery And Delay Risk',
    subtitleZh: '项目模块承接商机后的交付状态，AI 可结合里程碑、风险和合同数据解释延期原因。',
    subtitleEn: 'Projects carry delivery status after opportunity handoff; AI can explain delays using milestones, risks, and contract data.',
    action: 'scroll',
  },
  {
    id: '04-contracts',
    moduleId: 'commercial',
    path: '/backend/commercial/contracts',
    titleZh: '合同与商业口径',
    titleEn: 'Contracts And Commercial Metrics',
    subtitleZh: '合同页展示项目、客户和金额口径，为回款、开票、核销与经营分析提供同一业务来源。',
    subtitleEn: 'The contracts page ties projects, customers, and amount definitions into one source for billing, cash collection, and analysis.',
    action: 'scroll',
  },
  {
    id: '05-invoices',
    moduleId: 'commercial',
    path: '/backend/commercial/invoices',
    titleZh: '开票与逾期应收',
    titleEn: 'Invoices And Overdue Receivables',
    subtitleZh: '发票列表可直接定位逾期应收，经营参谋会说明应收余额、到期日和证据链接。',
    subtitleEn: 'The invoice list exposes overdue receivables; the advisor explains outstanding balance, due date, and evidence links.',
    action: 'scroll',
  },
  {
    id: '06-payments',
    moduleId: 'commercial',
    path: '/backend/commercial/payments',
    titleZh: '回款记录',
    titleEn: 'Payment Records',
    subtitleZh: '回款记录进入同一商业闭环，后续核销可以和发票、合同、项目一起追溯。',
    subtitleEn: 'Payments enter the same commercial loop, so allocations can be traced back to invoices, contracts, and projects.',
    action: 'scroll',
  },
  {
    id: '07-allocations',
    moduleId: 'commercial',
    path: '/backend/commercial/allocations',
    titleZh: '核销明细',
    titleEn: 'Allocation Details',
    subtitleZh: '核销页展示回款如何抵扣发票，确保经营摘要里的逾期余额不是凭空推断。',
    subtitleEn: 'Allocations show how payments offset invoices, proving that overdue balances are calculated from real records.',
    action: 'scroll',
  },
  {
    id: '08-kpi-board',
    moduleId: 'insights',
    path: '/backend/insights/kpi',
    titleZh: 'KPI 完成看板',
    titleEn: 'KPI Completion Board',
    subtitleZh: 'KPI 看板展示目标、实际完成和差额，AI 回答必须带公式来源和组织维度。',
    subtitleEn: 'The KPI board shows targets, actuals, and gaps; AI answers must include formula source and organization dimension.',
    action: 'scroll',
  },
  {
    id: '09-governance',
    moduleId: 'governance',
    path: '/backend/governance/findings',
    titleZh: '治理检出与处置',
    titleEn: 'Governance Findings And Disposition',
    subtitleZh: '治理页沉淀重复客户、逾期、延期和 critical 检出，并支持确认后批量处置。',
    subtitleEn: 'Governance captures duplicate customers, overdue items, delays, and critical findings with confirm-required disposition.',
    action: 'scroll',
  },
  {
    id: '10-customers',
    moduleId: 'customers',
    path: '/backend/customers/companies',
    titleZh: '客户主数据',
    titleEn: 'Customer Master Data',
    subtitleZh: '客户公司列表是经营链路的主数据入口，重复客户检出会回链到这里处理。',
    subtitleEn: 'Customer companies are the master-data entry point; duplicate-customer findings link back here for action.',
    action: 'scroll',
  },
  {
    id: '11-ai-playground',
    moduleId: 'ai_assistant',
    path: '/backend/config/ai-assistant/playground',
    titleZh: 'AI 助手验收 Playground',
    titleEn: 'AI Assistant Acceptance Playground',
    subtitleZh: 'Playground 用真实模型验证工具选择、数字稳定性、公式、证据和后台链接，而不是 mock 回答。',
    subtitleEn: 'The playground validates real-model tool selection, stable numbers, formulas, evidence, and backend links instead of mock replies.',
    action: 'overview',
  },
  {
    id: '12-agent-registry',
    moduleId: 'ai_assistant',
    path: '/backend/config/ai-assistant/agents',
    titleZh: 'AI Agent 注册表',
    titleEn: 'AI Agent Registry',
    subtitleZh: 'Agent 注册表展示经营参谋和模块助手的工具权限、写入策略和可解释能力边界。',
    subtitleEn: 'The agent registry shows tool permissions, write policies, and explanation boundaries for the advisor and module assistants.',
    action: 'scroll',
  },
  {
    id: '13-catalog',
    moduleId: 'catalog',
    path: '/backend/catalog/products',
    titleZh: '产品与服务目录',
    titleEn: 'Products And Services Catalog',
    subtitleZh: '商品与服务目录展示真实商品、SKU、渠道和价格数据，支持中文默认展示。',
    subtitleEn: 'The catalog shows real products, SKUs, channels, and prices with Chinese-first presentation.',
    action: 'scroll',
  },
  {
    id: '14-wms-inventory',
    moduleId: 'wms',
    path: '/backend/wms/inventory',
    titleZh: 'WMS 库存作业',
    titleEn: 'WMS Inventory Operations',
    subtitleZh: 'WMS 库存页展示入库、预留、移库、盘点和库存余额，作为平台扩展模块能力示例。',
    subtitleEn: 'The WMS inventory page shows receiving, reservation, movement, counts, and balances as an extensible module example.',
    action: 'scroll',
  },
  {
    id: '15-integrations',
    moduleId: 'integrations',
    path: '/backend/integrations',
    titleZh: '集成管理',
    titleEn: 'Integration Management',
    subtitleZh: '集成页展示外部系统连接状态，说明平台可以接入 Webhook、表格导入和第三方服务。',
    subtitleEn: 'The integrations page shows external-system connection status for webhooks, file imports, and third-party services.',
    action: 'scroll',
  },
]

export function parseBackendRoutes(source) {
  const entries = []
  const routePattern = /\{\s*moduleId:\s*"([^"]+)"[\s\S]*?resolvePageRouteMetadata\("([^"]+)"/g
  let match
  while ((match = routePattern.exec(source)) !== null) {
    entries.push({ moduleId: match[1], path: match[2] })
  }
  return entries
}

function routeScore(route) {
  let score = 100
  if (route.path.includes('[')) score -= 1_000
  if (route.path.includes('/create')) score -= 200
  if (route.path.includes('/config/')) score -= 70
  if (route.path.includes('/profile')) score -= 60
  if (route.path.endsWith(`/${route.moduleId}`)) score += 80
  if (route.path.split('/').length <= 4) score += 40
  if (route.path.includes('/operating-loop/today')) score += 60
  return score
}

export function buildAllModuleScenesFromRoutes(routes) {
  const byModule = new Map()
  for (const route of routes) {
    if (!route.moduleId || !route.path.startsWith('/backend')) continue
    if (route.path.includes('[')) continue
    const current = byModule.get(route.moduleId)
    if (!current || routeScore(route) > routeScore(current)) {
      byModule.set(route.moduleId, route)
    }
  }
  return Array.from(byModule.values())
    .sort((a, b) => a.moduleId.localeCompare(b.moduleId))
    .map((route, index) => {
      const ordinal = String(index + 1).padStart(2, '0')
      const title = humanizeModuleId(route.moduleId)
      return {
        id: `${ordinal}-${slugify(route.moduleId)}`,
        moduleId: route.moduleId,
        path: route.path,
        titleZh: `${title} 模块概览`,
        titleEn: `${title} Module Overview`,
        subtitleZh: `${title} 模块展示真实后台入口、列表视图和可操作业务数据。`,
        subtitleEn: `The ${title} module shows a real backend entry point, list view, and actionable business data.`,
        action: 'scroll',
      }
    })
}

export function loadAllModuleScenes(generatedRoutesPath) {
  const source = readFileSync(generatedRoutesPath, 'utf8')
  return buildAllModuleScenesFromRoutes(parseBackendRoutes(source))
}

export function resolveScenes({ mode = 'competition', sceneIds = [], limit = null, generatedRoutesPath } = {}) {
  const baseScenes = mode === 'all-modules'
    ? loadAllModuleScenes(generatedRoutesPath)
    : COMPETITION_SCENES
  const selected = sceneIds.length > 0
    ? baseScenes.filter((scene) => sceneIds.includes(scene.id) || sceneIds.includes(scene.moduleId))
    : baseScenes
  return Number.isInteger(limit) && limit > 0 ? selected.slice(0, limit) : selected
}

export function buildSrt(cues) {
  return `${cues.map((cue, index) => [
    String(index + 1),
    `${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}`,
    cue.text,
  ].join('\n')).join('\n\n')}\n`
}

export function buildVtt(cues) {
  return `WEBVTT\n\n${cues.map((cue) => [
    `${formatVttTimestamp(cue.startMs)} --> ${formatVttTimestamp(cue.endMs)}`,
    cue.text,
  ].join('\n')).join('\n\n')}\n`
}

export function buildSceneCues(scene, durationMs = DEFAULT_SCENE_DURATION_MS, locale = 'zh') {
  const title = locale === 'en' ? scene.titleEn : scene.titleZh
  const subtitle = locale === 'en' ? scene.subtitleEn : scene.subtitleZh
  return [
    {
      startMs: 0,
      endMs: durationMs,
      text: `${title}\n${subtitle}`,
    },
  ]
}

export function formatSrtTimestamp(ms) {
  const { hours, minutes, seconds, millis } = splitTimestamp(ms)
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${String(millis).padStart(3, '0')}`
}

export function formatVttTimestamp(ms) {
  const { hours, minutes, seconds, millis } = splitTimestamp(ms)
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${String(millis).padStart(3, '0')}`
}

export function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'scene'
}

function splitTimestamp(ms) {
  const totalMs = Math.max(0, Math.floor(ms))
  const hours = Math.floor(totalMs / 3_600_000)
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000)
  const seconds = Math.floor((totalMs % 60_000) / 1_000)
  const millis = totalMs % 1_000
  return { hours, minutes, seconds, millis }
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function humanizeModuleId(moduleId) {
  return String(moduleId)
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
