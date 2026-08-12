import { readFileSync } from 'node:fs'

export const DEFAULT_VIEWPORT = { width: 1920, height: 1080 }
export const DEFAULT_SCENE_DURATION_MS = 8_000
export const DEFAULT_AI_WAIT_MS = 20_000

const OPERATING_LOOP_AGENT_ID = 'insights.operating_loop_assistant'

const BASE_COMPETITION_SCENES = [
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

const COMPETITION_SCENE_DETAILS = {
  '01-login-home': {
    featureZh: '展示中文默认工作台、思维图新组织切换、通知入口、全局搜索和 AI 入口，为后续闭环演示建立上下文。',
    featureEn: 'Shows the Chinese-first workspace, NavInfo organization switcher, notifications, global search, and AI entry point for the loop.',
    agentId: OPERATING_LOOP_AGENT_ID,
    aiPromptZh: '请用经营参谋视角说明这个租户今天应该先看哪些异常，并明确你会调用哪些真实数据工具。',
    aiPromptEn: 'As the operating advisor, explain which exceptions this tenant should inspect first today and name the real data tools you would call.',
  },
  '02-today-digest': {
    featureZh: '按 critical 检出、逾期应收、延期项目、KPI 缺口分组看今日经营异常，点击条目可以回到源记录。',
    featureEn: 'Reviews today’s exceptions grouped by critical findings, overdue receivables, delayed projects, and KPI gaps with source-record links.',
    agentId: OPERATING_LOOP_AGENT_ID,
    aiPromptZh: '请基于当前今日经营摘要，按 critical 检出、逾期应收、延期项目、KPI 缺口汇总风险。每组必须给数字、公式来源、证据链接和下一步动作。',
    aiPromptEn: 'Based on the current daily digest, summarize critical findings, overdue receivables, delayed projects, and KPI gaps with numbers, formula sources, evidence links, and next actions.',
  },
  '03-projects': {
    featureZh: '项目列表展示交付状态、负责人、里程碑和风险，是“商机到交付”链路的执行层。',
    featureEn: 'The project list shows delivery status, owners, milestones, and risks as the execution layer from opportunity to delivery.',
    agentId: 'projects.delivery_assistant',
    aiPromptZh: '请找出当前项目列表里最需要关注的延期风险，并说明延期依据、关联合同回款、治理检出和后台链接。',
    aiPromptEn: 'Find the most important delayed-project risks on this page and explain the delay evidence, related contracts/cash collection, governance findings, and backend links.',
  },
  '04-contracts': {
    featureZh: '合同页承接客户、项目、金额、签约和履约状态，是后续开票、回款、核销的商业主线。',
    featureEn: 'Contracts connect customers, projects, amounts, signing, and fulfillment status as the commercial backbone for invoicing, payments, and allocations.',
    agentId: 'commercial.settlement_assistant',
    aiPromptZh: '请按项目聚合当前合同经营口径，说明合同金额、已开票、已回款、未核销和证据链接。',
    aiPromptEn: 'Aggregate the current contract metrics by project and explain contracted amount, invoiced, collected, unallocated, and evidence links.',
  },
  '05-invoices': {
    featureZh: '发票列表把开票金额、到期日、收款状态和合同项目关联起来，用于定位逾期应收。',
    featureEn: 'Invoices link amounts, due dates, collection status, contracts, and projects to identify overdue receivables.',
    agentId: 'commercial.settlement_assistant',
    aiPromptZh: '请列出当前组织的逾期应收清单，说明应收余额公式、到期日、逾期天数、关联合同项目和后台链接。',
    aiPromptEn: 'List overdue receivables for the current organization with AR balance formula, due date, overdue days, related contract/project, and backend links.',
  },
  '06-payments': {
    featureZh: '回款记录展示客户付款流水，后续通过核销与发票匹配，形成现金回收证据。',
    featureEn: 'Payment records show customer cash receipts that later match invoices through allocations as collection evidence.',
    agentId: 'commercial.settlement_assistant',
    aiPromptZh: '请说明最近回款如何影响逾期应收，并指出哪些回款还需要核销，返回相关付款、发票和合同链接。',
    aiPromptEn: 'Explain how recent payments affect overdue receivables and identify payments still needing allocation with payment, invoice, and contract links.',
  },
  '07-allocations': {
    featureZh: '核销明细展示每笔回款抵扣了哪些发票，确保经营摘要中的余额来自真实抵扣链路。',
    featureEn: 'Allocation details show which invoices each payment offsets, proving that digest balances come from real settlement chains.',
    agentId: 'commercial.settlement_assistant',
    aiPromptZh: '请解释当前核销链路里是否存在未核销或部分核销风险，并给出影响金额、公式来源和后台链接。',
    aiPromptEn: 'Explain whether there are unallocated or partially allocated risks, with impact amount, formula source, and backend links.',
  },
  '08-kpi-board': {
    featureZh: 'KPI 看板把目标、实际、完成率、缺口和组织维度放在同一页，用于判断谁拖慢经营目标。',
    featureEn: 'The KPI board combines target, actual, completion rate, gap, and organization dimension to identify what slows operating goals.',
    agentId: 'insights.kpi_assistant',
    aiPromptZh: '请说明当前 KPI 哪些指标差目标最多，按组织指出拖后腿项，并给出完成率公式、差额和后台链接。',
    aiPromptEn: 'Explain which KPI metrics miss target most, identify the lagging organization dimension, and include completion-rate formula, gap, and backend links.',
  },
  '09-governance': {
    featureZh: '治理检出沉淀重复客户、延期、逾期和 critical 规则命中，支持确认后批量处置。',
    featureEn: 'Governance findings capture duplicate customers, delays, overdue items, and critical rule hits with confirm-required bulk disposition.',
    agentId: 'governance.assistant',
    aiPromptZh: '请基于当前治理检出生成批量处置建议，包含负责人角色、建议完成日、影响摘要，并只生成 confirm-required 预览，不要直接确认执行。',
    aiPromptEn: 'Create a bulk disposition proposal from current governance findings with owner role, suggested due date, impact summary, and only a confirm-required preview. Do not confirm it.',
  },
  '10-customers': {
    featureZh: '客户主数据维护客户公司、联系人和业务关系，重复客户治理会回链到这里合并或确认。',
    featureEn: 'Customer master data manages companies, contacts, and relationships; duplicate-customer governance links back here for merge or acknowledgement.',
    agentId: 'customers.account_assistant',
    aiPromptZh: '请检查当前客户主数据是否存在重复或关键信息缺失，并说明治理证据、影响范围和后台链接。',
    aiPromptEn: 'Check whether current customer master data has duplicates or missing critical fields, and explain governance evidence, impact scope, and backend links.',
  },
  '11-ai-playground': {
    featureZh: 'Playground 用固定中文 prompt 回归真实模型，验证工具选择、数字稳定、公式来源和链接输出。',
    featureEn: 'The playground runs fixed Chinese prompt regressions against the real model to verify tool choice, stable numbers, formula sources, and links.',
    agentId: OPERATING_LOOP_AGENT_ID,
    aiPromptZh: '请用一句话说明真实模型验收时必须检查哪些内容：工具、数字、公式、证据链接和 confirm-required 预览。',
    aiPromptEn: 'In one sentence, explain what real-model acceptance must verify: tools, numbers, formulas, evidence links, and confirm-required previews.',
  },
  '12-agent-registry': {
    featureZh: 'Agent 注册表展示每个助手的工具白名单、写入策略、模型设置和提示词边界。',
    featureEn: 'The agent registry shows each assistant’s tool allowlist, write policy, model settings, and prompt boundaries.',
    agentId: OPERATING_LOOP_AGENT_ID,
    aiPromptZh: '请解释经营参谋和模块助手的职责边界，尤其是只读、建议、confirm-required 写入三类能力如何区分。',
    aiPromptEn: 'Explain the responsibility boundary between the operating advisor and module assistants, especially read-only, suggestion, and confirm-required write capabilities.',
  },
  '13-catalog': {
    featureZh: '产品与服务目录展示商品标题、SKU、分类、渠道、价格和 SEO 健康度，支持中文默认展示。',
    featureEn: 'The catalog shows product titles, SKUs, categories, channels, prices, and SEO health with Chinese-first presentation.',
    agentId: 'catalog.catalog_assistant',
    aiPromptZh: '请检查当前产品与服务目录的 SEO、渠道和价格信息，指出最值得优化的条目，并返回产品链接。',
    aiPromptEn: 'Inspect the current products and services catalog for SEO, channel, and pricing issues, identify the highest-value improvements, and return product links.',
  },
  '14-wms-inventory': {
    featureZh: 'WMS 库存作业展示入库、预留、移库、盘点和库存余额，是平台可扩展模块能力。',
    featureEn: 'WMS inventory operations show receiving, reservations, movements, counts, and balances as an extensible module capability.',
    agentId: OPERATING_LOOP_AGENT_ID,
    aiPromptZh: '请说明库存页在经营闭环里的作用；如果当前没有库存数据，请明确说没有可计算库存余额，不要编造数字。',
    aiPromptEn: 'Explain the role of the inventory page in the operating loop; if there is no inventory data, state that no balance can be calculated and do not invent numbers.',
  },
  '15-integrations': {
    featureZh: '集成管理展示 Webhook、表格导入、支付和邮件等外部系统连接，用于把真实业务数据接入闭环。',
    featureEn: 'Integration management shows webhook, file import, payment, and email connections that bring real business data into the loop.',
    agentId: OPERATING_LOOP_AGENT_ID,
    aiPromptZh: '请说明这些集成如何把外部系统数据接入经营闭环，并指出哪些状态需要配置或关注。',
    aiPromptEn: 'Explain how these integrations bring external-system data into the operating loop and identify which statuses need configuration or attention.',
  },
}

export const COMPETITION_SCENES = BASE_COMPETITION_SCENES.map((scene) => ({
  ...scene,
  ...COMPETITION_SCENE_DETAILS[scene.id],
}))

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
        featureZh: `${title} 模块展示真实后台入口、列表视图、筛选和可操作业务数据。`,
        featureEn: `The ${title} module shows a real backend entry point, list view, filters, and actionable business data.`,
        agentId: OPERATING_LOOP_AGENT_ID,
        aiPromptZh: `请结合当前 ${title} 页面说明这个模块能做什么；如果没有可读数据，请明确说明，不要编造数字。`,
        aiPromptEn: `Use the current ${title} page to explain what this module can do. If no readable data exists, say so clearly and do not invent numbers.`,
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

export function buildSceneSteps(scene, {
  durationMs = DEFAULT_SCENE_DURATION_MS,
  aiWaitMs = DEFAULT_AI_WAIT_MS,
  includeAi = true,
} = {}) {
  const introMs = Math.max(1_500, Math.min(3_000, Math.floor(durationMs * 0.25)))
  const exploreMs = Math.max(2_000, Math.min(6_000, Math.floor(durationMs * 0.45)))
  const aiMs = includeAi && scene.aiPromptZh ? Math.max(4_000, aiWaitMs) : 0
  const wrapMs = Math.max(1_000, durationMs - introMs - exploreMs)
  const steps = [
    {
      id: 'overview',
      kind: 'pause',
      durationMs: introMs,
      titleZh: scene.titleZh,
      titleEn: scene.titleEn,
      subtitleZh: scene.subtitleZh,
      subtitleEn: scene.subtitleEn,
    },
    {
      id: 'module-tour',
      kind: scene.action === 'scroll' ? 'scroll' : 'pause',
      durationMs: exploreMs,
      titleZh: '模块功能导览',
      titleEn: 'Module Feature Tour',
      subtitleZh: scene.featureZh ?? scene.subtitleZh,
      subtitleEn: scene.featureEn ?? scene.subtitleEn,
    },
  ]

  if (aiMs > 0) {
    steps.push({
      id: 'ai-dialogue',
      kind: 'ai',
      durationMs: aiMs,
      agentId: scene.agentId ?? OPERATING_LOOP_AGENT_ID,
      promptZh: scene.aiPromptZh,
      promptEn: scene.aiPromptEn,
      titleZh: 'AI 对话与执行效果',
      titleEn: 'AI Dialogue And Execution',
      subtitleZh: `输入给 ${scene.agentId ?? OPERATING_LOOP_AGENT_ID}：${scene.aiPromptZh}`,
      subtitleEn: `Prompt to ${scene.agentId ?? OPERATING_LOOP_AGENT_ID}: ${scene.aiPromptEn ?? scene.aiPromptZh}`,
    })
  } else {
    steps.push({
      id: 'wrap',
      kind: 'pause',
      durationMs: wrapMs,
      titleZh: '演示收束',
      titleEn: 'Wrap-up',
      subtitleZh: '该场景完成真实页面录制，可继续进入下一个模块。',
      subtitleEn: 'This scene has recorded the real page and can continue to the next module.',
    })
  }

  return steps
}

export function buildSceneCues(scene, durationMs = DEFAULT_SCENE_DURATION_MS, locale = 'zh', options = {}) {
  let cursor = 0
  return buildSceneSteps(scene, { durationMs, ...options }).map((step) => {
    const title = locale === 'en' ? step.titleEn : step.titleZh
    const subtitle = locale === 'en' ? step.subtitleEn : step.subtitleZh
    const startMs = cursor
    const endMs = cursor + step.durationMs
    cursor = endMs
    return {
      startMs,
      endMs,
      text: `${title}\n${subtitle}`,
    }
  })
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
