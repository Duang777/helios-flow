import type { LucideIcon } from 'lucide-react'
import {
  Archive,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardList,
  ContactRound,
  FileText,
  Gauge,
  GitBranch,
  Globe2,
  LayoutDashboard,
  PackageCheck,
  ReceiptText,
  Shield,
  ShoppingCart,
  Sparkles,
  Tags,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'

export type DemoScreen = 'start' | 'backend'
export type DemoArea =
  | 'dashboard'
  | 'company'
  | 'calendar'
  | 'customerTasks'
  | 'contacts'
  | 'products'
  | 'categories'
  | 'createSalesDoc'
  | 'quotes'
  | 'orders'
  | 'salesChannels'
  | 'operationalDashboard'
  | 'warehouse'
  | 'shipping'
export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export type RoleCard = {
  title: string
  description: string
  features: string[]
  icon: LucideIcon
  variant: 'primary' | 'secondary' | 'outline'
}

export type SidebarGroup = {
  title: string
  items: {
    id: DemoArea
    title: string
    icon: LucideIcon
  }[]
}

export type RailApp = {
  title: string
  short: string
  tone: StatusTone
}

export type DashboardCard = {
  title: string
  description: string
  icon: LucideIcon
}

export type RecordCard = {
  id: string
  title: string
  subtitle: string
  meta: string
  tone: StatusTone
}

export type Metric = {
  label: string
  value: string
  detail: string
  tone: StatusTone
}

export type Workflow = {
  id: string
  title: string
  description: string
  progress: number
  tone: StatusTone
  icon: LucideIcon
}

export const areaMeta: Record<DemoArea, { title: string; description: string; empty: string }> = {
  dashboard: {
    title: '仪表盘',
    description: '排列并个性化四维图新公司在管理后台首页看到的小组件。',
    empty: '暂无客户任务。',
  },
  company: {
    title: '公司',
    description: '维护集团、事业群、客户与合作伙伴的组织档案。',
    empty: '暂无匹配公司。',
  },
  calendar: {
    title: '历法',
    description: '查看项目会议、发布时间窗和团队日程。',
    empty: '暂无匹配日程。',
  },
  customerTasks: {
    title: '客户相关任务',
    description: '跟踪客户协同、项目确认与交付任务。',
    empty: '暂无匹配任务。',
  },
  contacts: {
    title: '联系人',
    description: '维护客户、供应商和项目联系人的通讯录。',
    empty: '暂无匹配联系人。',
  },
  products: {
    title: '产品与服务',
    description: '管理高精地图、智能网联、车路云和位置服务产品目录。',
    empty: '暂无匹配产品。',
  },
  categories: {
    title: '分类',
    description: '按能力域、区域和交付类型管理分类。',
    empty: '暂无匹配分类。',
  },
  createSalesDoc: {
    title: '创建销售单据',
    description: '起草报价、合同和交付确认单。',
    empty: '暂无可创建的单据。',
  },
  quotes: {
    title: '报价',
    description: '查看四维图新公司的项目报价与审批状态。',
    empty: '暂无匹配报价。',
  },
  orders: {
    title: '订单',
    description: '跟踪已签署订单、履约节点和回款进度。',
    empty: '暂无匹配订单。',
  },
  salesChannels: {
    title: '销售渠道',
    description: '管理直销、伙伴和战略客户渠道。',
    empty: '暂无匹配渠道。',
  },
  operationalDashboard: {
    title: 'Operational dashboard',
    description: '跟踪自动化数据更新、质检、审批和通知动作。',
    empty: '暂无匹配自动化记录。',
  },
  warehouse: {
    title: '仓库',
    description: '查看仓库库存、调拨和缺货预警。',
    empty: '暂无匹配仓库记录。',
  },
  shipping: {
    title: '发货',
    description: '跟踪运输、签收和异常处理状态。',
    empty: '暂无匹配发货记录。',
  },
}

export const roleCards: RoleCard[] = [
  {
    title: '集团管理员',
    description: '管理四维图新公司级工作区',
    features: [
      '维护组织结构和权限',
      '配置业务模块与数据范围',
      '查看跨事业群经营仪表盘',
      '审核自动化写入动作',
    ],
    icon: Shield,
    variant: 'primary',
  },
  {
    title: '业务负责人',
    description: '负责事业群和项目交付',
    features: [
      '管理客户与车厂项目',
      '跟踪订单和交付节点',
      '查看数据服务指标',
      '处理风险和审批提醒',
    ],
    icon: Users,
    variant: 'secondary',
  },
  {
    title: '项目成员',
    description: '处理日常任务和协作',
    features: [
      '处理分配的更新任务',
      '查看项目资源和记录',
      '同步交付进度',
      '提交质检和巡检结果',
    ],
    icon: BriefcaseBusiness,
    variant: 'outline',
  },
]

export const railApps: RailApp[] = [
  { title: '四维图新', short: 'SW', tone: 'success' },
  { title: 'race', short: 'ra', tone: 'warning' },
  { title: '文档', short: 'WD', tone: 'info' },
  { title: '卡密充值', short: 'KM', tone: 'neutral' },
  { title: 'AI先锋未来', short: 'AI', tone: 'success' },
  { title: 'Repository', short: 'GH', tone: 'neutral' },
  { title: 'Helios', short: 'He', tone: 'neutral' },
]

export const sidebarGroups: SidebarGroup[] = [
  {
    title: '客户',
    items: [
      { id: 'dashboard', title: '仪表盘', icon: LayoutDashboard },
      { id: 'company', title: '公司', icon: Building2 },
      { id: 'calendar', title: '历法', icon: CalendarDays },
      { id: 'customerTasks', title: '客户相关任务', icon: ClipboardList },
      { id: 'contacts', title: '联系人', icon: ContactRound },
    ],
  },
  {
    title: '目录',
    items: [
      { id: 'products', title: '产品与服务', icon: PackageCheck },
      { id: 'categories', title: '分类', icon: Tags },
    ],
  },
  {
    title: '销售',
    items: [
      { id: 'createSalesDoc', title: '创建销售单据', icon: FileText },
      { id: 'quotes', title: '报价', icon: ReceiptText },
      { id: 'orders', title: '订单', icon: ShoppingCart },
      { id: 'salesChannels', title: '销售渠道', icon: Globe2 },
    ],
  },
  {
    title: 'WMS',
    items: [
      { id: 'operationalDashboard', title: 'Operational dashboard', icon: Gauge },
      { id: 'warehouse', title: '仓库', icon: Warehouse },
      { id: 'shipping', title: '发货', icon: Truck },
    ],
  },
]

export const dashboardCards: DashboardCard[] = [
  {
    title: '客户任务',
    description: '查看与客户关联的最新任务，并直接跳转到相关记录。',
    icon: ClipboardList,
  },
  {
    title: '新客户',
    description: '跟踪最近添加的客户，以便快速跟进。',
    icon: Users,
  },
  {
    title: '新商机',
    description: '跟踪最近创建的客户商机，以便快速跟进。',
    icon: BriefcaseBusiness,
  },
]

export const customerRecords: RecordCard[] = [
  {
    id: 'customer-1',
    title: '四维图新地图平台部',
    subtitle: '公司',
    meta: 'Aug 6, 2026, 2:08 AM',
    tone: 'success',
  },
  {
    id: 'customer-2',
    title: '智能网联事业群',
    subtitle: '公司',
    meta: 'Aug 6, 2026, 2:08 AM',
    tone: 'info',
  },
  {
    id: 'customer-3',
    title: '北京图新经纬科技',
    subtitle: '子公司',
    meta: 'Aug 6, 2026, 2:08 AM',
    tone: 'neutral',
  },
  {
    id: 'customer-4',
    title: '合作车厂项目组',
    subtitle: '客户',
    meta: 'Aug 6, 2026, 2:08 AM',
    tone: 'warning',
  },
]

export const opportunityRecords: RecordCard[] = [
  {
    id: 'opportunity-1',
    title: '高精地图更新任务',
    subtitle: '推进中',
    meta: '查看记录',
    tone: 'warning',
  },
  {
    id: 'opportunity-2',
    title: '城市 NOA 测试项目',
    subtitle: '跟进中',
    meta: '查看记录',
    tone: 'info',
  },
  {
    id: 'opportunity-3',
    title: '车路云一体化示范区',
    subtitle: '关注',
    meta: '查看记录',
    tone: 'success',
  },
  {
    id: 'opportunity-4',
    title: '智能座舱数据服务',
    subtitle: '高需',
    meta: '查看记录',
    tone: 'neutral',
  },
]

export const metrics: Metric[] = [
  {
    label: '数据更新任务',
    value: '128',
    detail: '本周进入排期',
    tone: 'success',
  },
  {
    label: '车厂项目',
    value: '42',
    detail: '处于交付跟踪',
    tone: 'info',
  },
  {
    label: '质检预警',
    value: '7',
    detail: '需要人工复核',
    tone: 'warning',
  },
]

export const workflows: Workflow[] = [
  {
    id: 'map-update',
    title: '地图更新闭环',
    description: '采集、编译、质检、发布和客户通知的全流程跟踪。',
    progress: 76,
    tone: 'success',
    icon: GitBranch,
  },
  {
    id: 'delivery-risk',
    title: '交付风险处置',
    description: '识别延期风险，生成负责人任务，并同步项目干系人。',
    progress: 58,
    tone: 'warning',
    icon: Archive,
  },
  {
    id: 'ai-review',
    title: 'AI 辅助复核',
    description: '生成项目摘要和质检建议，所有写入动作保留人工确认。',
    progress: 68,
    tone: 'info',
    icon: Sparkles,
  },
]

export const pageContent: Record<
  Exclude<DemoArea, 'dashboard'>,
  {
    title: string
    description: string
    empty: string
    records: RecordCard[]
  }
> = {
  company: {
    title: areaMeta.company.title,
    description: areaMeta.company.description,
    empty: areaMeta.company.empty,
    records: [
      { id: 'company-1', title: '四维图新新地图平台部', subtitle: '公司', meta: '总部组织档案', tone: 'success' },
      { id: 'company-2', title: '智能网联事业群', subtitle: '公司', meta: '聚焦车路云协同', tone: 'info' },
      { id: 'company-3', title: '北京图新经纬科技', subtitle: '子公司', meta: '地图与位置服务', tone: 'neutral' },
      { id: 'company-4', title: '合作车厂项目组', subtitle: '客户', meta: '重点交付协同', tone: 'warning' },
    ],
  },
  calendar: {
    title: areaMeta.calendar.title,
    description: areaMeta.calendar.description,
    empty: areaMeta.calendar.empty,
    records: [
      { id: 'calendar-1', title: '地图版本发布会', subtitle: '会议', meta: 'Aug 7, 2026, 09:30', tone: 'success' },
      { id: 'calendar-2', title: '车厂对齐会', subtitle: '会议', meta: 'Aug 7, 2026, 14:00', tone: 'warning' },
      { id: 'calendar-3', title: '项目评审窗口', subtitle: '日程', meta: 'Aug 8, 2026, 10:00', tone: 'info' },
      { id: 'calendar-4', title: '团队周会', subtitle: '日程', meta: 'Aug 8, 2026, 17:00', tone: 'neutral' },
    ],
  },
  customerTasks: {
    title: areaMeta.customerTasks.title,
    description: areaMeta.customerTasks.description,
    empty: areaMeta.customerTasks.empty,
    records: [
      { id: 'task-1', title: '同步车厂字段变更', subtitle: '待处理', meta: '客户成功团队', tone: 'warning' },
      { id: 'task-2', title: '补充地图版本说明', subtitle: '进行中', meta: '产品运营', tone: 'info' },
      { id: 'task-3', title: '确认交付窗口', subtitle: '已排期', meta: '项目管理', tone: 'success' },
      { id: 'task-4', title: '回收测试反馈', subtitle: '待确认', meta: '质量保障', tone: 'neutral' },
    ],
  },
  contacts: {
    title: areaMeta.contacts.title,
    description: areaMeta.contacts.description,
    empty: areaMeta.contacts.empty,
    records: [
      { id: 'contact-1', title: '张启明', subtitle: '项目负责人', meta: '智能网联事业群', tone: 'success' },
      { id: 'contact-2', title: '王思雨', subtitle: '客户经理', meta: '地图平台部', tone: 'info' },
      { id: 'contact-3', title: '刘柏然', subtitle: '售前顾问', meta: '车厂项目组', tone: 'warning' },
      { id: 'contact-4', title: '陈静', subtitle: '交付协调', meta: '合作伙伴', tone: 'neutral' },
    ],
  },
  products: {
    title: areaMeta.products.title,
    description: areaMeta.products.description,
    empty: areaMeta.products.empty,
    records: [
      { id: 'product-1', title: '高精地图数据服务', subtitle: '产品', meta: '覆盖高速、城市快速路与重点城区', tone: 'success' },
      { id: 'product-2', title: '位置大数据平台', subtitle: '服务', meta: '支持项目态势、区域运营与客户看板', tone: 'info' },
      { id: 'product-3', title: '智能网联解决方案', subtitle: '方案', meta: '车端、路侧、云端协同交付', tone: 'warning' },
      { id: 'product-4', title: '导航 SDK', subtitle: 'SDK', meta: '面向开发团队的集成包', tone: 'neutral' },
    ],
  },
  categories: {
    title: areaMeta.categories.title,
    description: areaMeta.categories.description,
    empty: areaMeta.categories.empty,
    records: [
      { id: 'category-1', title: '地图服务', subtitle: '分类', meta: '底图、路网、POI', tone: 'success' },
      { id: 'category-2', title: '车路云', subtitle: '分类', meta: '路侧设备与云平台', tone: 'info' },
      { id: 'category-3', title: '智能座舱', subtitle: '分类', meta: '导航与语音能力', tone: 'warning' },
      { id: 'category-4', title: '项目交付', subtitle: '分类', meta: '实施、验收、运维', tone: 'neutral' },
    ],
  },
  createSalesDoc: {
    title: areaMeta.createSalesDoc.title,
    description: areaMeta.createSalesDoc.description,
    empty: areaMeta.createSalesDoc.empty,
    records: [
      { id: 'sales-doc-1', title: '新建报价单', subtitle: '草稿', meta: '智能网联事业群', tone: 'warning' },
      { id: 'sales-doc-2', title: '项目合同模板', subtitle: '模板', meta: '法务审批', tone: 'info' },
      { id: 'sales-doc-3', title: '交付确认单', subtitle: '模板', meta: '交付团队', tone: 'success' },
      { id: 'sales-doc-4', title: '回款提醒单', subtitle: '草稿', meta: '财务协同', tone: 'neutral' },
    ],
  },
  quotes: {
    title: areaMeta.quotes.title,
    description: areaMeta.quotes.description,
    empty: areaMeta.quotes.empty,
    records: [
      { id: 'quote-1', title: '华北车厂报价', subtitle: '审批中', meta: '预计回签 8 月 9 日', tone: 'warning' },
      { id: 'quote-2', title: '地图平台续约报价', subtitle: '待确认', meta: '客户侧评审中', tone: 'info' },
      { id: 'quote-3', title: '车路云示范区报价', subtitle: '已通过', meta: '可发起签署', tone: 'success' },
      { id: 'quote-4', title: '数据服务补充报价', subtitle: '草稿', meta: '销售经理确认中', tone: 'neutral' },
    ],
  },
  orders: {
    title: areaMeta.orders.title,
    description: areaMeta.orders.description,
    empty: areaMeta.orders.empty,
    records: [
      { id: 'order-1', title: 'SO-10482', subtitle: '履约中', meta: '高精地图项目', tone: 'success' },
      { id: 'order-2', title: 'SO-10479', subtitle: '等待发货', meta: '导航 SDK', tone: 'warning' },
      { id: 'order-3', title: 'SO-10476', subtitle: '待回款', meta: '位置大数据平台', tone: 'info' },
      { id: 'order-4', title: 'SO-10471', subtitle: '已关闭', meta: '示范区测试包', tone: 'neutral' },
    ],
  },
  salesChannels: {
    title: areaMeta.salesChannels.title,
    description: areaMeta.salesChannels.description,
    empty: areaMeta.salesChannels.empty,
    records: [
      { id: 'channel-1', title: '直销', subtitle: '渠道', meta: '重点大客户', tone: 'success' },
      { id: 'channel-2', title: '战略合作伙伴', subtitle: '渠道', meta: '区域协同', tone: 'info' },
      { id: 'channel-3', title: '生态伙伴', subtitle: '渠道', meta: '联合解决方案', tone: 'warning' },
      { id: 'channel-4', title: '线上线索', subtitle: '渠道', meta: '官网与活动导入', tone: 'neutral' },
    ],
  },
  operationalDashboard: {
    title: areaMeta.operationalDashboard.title,
    description: areaMeta.operationalDashboard.description,
    empty: areaMeta.operationalDashboard.empty,
    records: [
      { id: 'ops-1', title: '自动同步检查', subtitle: '健康', meta: '最近一次 2 分钟前', tone: 'success' },
      { id: 'ops-2', title: '审批等待队列', subtitle: '关注', meta: '3 条待确认', tone: 'warning' },
      { id: 'ops-3', title: '通知发送统计', subtitle: '正常', meta: '98% 成功率', tone: 'info' },
      { id: 'ops-4', title: '失败重试任务', subtitle: '稳定', meta: '0 条堆积', tone: 'neutral' },
    ],
  },
  warehouse: {
    title: areaMeta.warehouse.title,
    description: areaMeta.warehouse.description,
    empty: areaMeta.warehouse.empty,
    records: [
      { id: 'warehouse-1', title: '北京仓', subtitle: '库存充足', meta: '地图基础包 82%', tone: 'success' },
      { id: 'warehouse-2', title: '上海仓', subtitle: '缺货预警', meta: '项目定制包 24%', tone: 'warning' },
      { id: 'warehouse-3', title: '深圳仓', subtitle: '处理中', meta: '等待调拨 11 单', tone: 'info' },
      { id: 'warehouse-4', title: '成都仓', subtitle: '稳定', meta: '低风险区域', tone: 'neutral' },
    ],
  },
  shipping: {
    title: areaMeta.shipping.title,
    description: areaMeta.shipping.description,
    empty: areaMeta.shipping.empty,
    records: [
      { id: 'ship-1', title: '华北线路发运', subtitle: '运输中', meta: '预计明早到达', tone: 'success' },
      { id: 'ship-2', title: '车厂样件发货', subtitle: '待装车', meta: '今天 16:00 截止', tone: 'warning' },
      { id: 'ship-3', title: '路侧设备补发', subtitle: '跟踪中', meta: '物流已接单', tone: 'info' },
      { id: 'ship-4', title: '紧急替换件', subtitle: '已签收', meta: '异常已关闭', tone: 'neutral' },
    ],
  },
}

export const demoCopy = {
  repoUrl: 'https://github.com/Duang777/helios-flow',
  productName: 'Helios',
  githubPagesNote: 'GitHub Pages 纯前端体验',
  introTitle: '四维图新公司工作区',
  introSubtitle: '正在接入地图数据、项目交付与可信 AI 协同能力',
  introLoading: '准备体验环境',
  skipIntro: '跳过开场',
  enterWorkspace: '进入体验工作区',
  openRepository: '打开仓库',
  resetLabel: '重置体验',
  startTitle: '四维图新公司 Helios 体验工作区',
  startDescription:
    '这个 GitHub Pages demo 复刻 Helios 的启动页、后台框架和业务组件，并使用四维图新公司的地图数据、智能网联和项目交付场景作为演示内容。',
  loginTitle: '访问四维图新公司工作区',
  loginEmail: 'demo@navinfo.com',
  loginPassword: 'secret',
  loginRemember: '记住我',
  loginButton: '登录',
  loginForgot: '忘记密码？',
  heroTitle: '以清晰可控的方式管理地图数据与智能出行业务。',
  roleTitle: '选择体验角色',
  passwordTitle: 'Default Password',
  passwordDescription: '所有体验账号的默认密码都是 secret；本页面不会发送真实登录请求。',
  apiTitle: 'API resources',
  apiDescription: 'Explore docs and OpenAPI exports for this installation.',
  searchPlaceholder: '搜索...',
  topbarSearchLabel: 'Search',
  organization: '四维图新公司',
  organizationAlt: '智能网联事业群',
  dashboardTitle: '仪表盘',
  dashboardDescription: '排列并个性化四维图新公司在管理后台首页看到的小组件。',
  customize: '自定义',
  emptyTask: '暂无客户任务。',
  viewRecord: '查看记录',
  refresh: '刷新',
  contact: '联系我们',
  actionSaved: '已在本地模拟完成',
  customizeOn: '正在自定义',
  customizeDescription: '拖拽排序在静态 demo 中以本地状态模拟；关闭后恢复普通浏览模式。',
  localBadge: 'localhost:3000/backend',
}

export const toneLabel: Record<StatusTone, string> = {
  success: 'Healthy',
  warning: 'Attention',
  error: 'Blocked',
  info: 'In progress',
  neutral: 'Stable',
}
