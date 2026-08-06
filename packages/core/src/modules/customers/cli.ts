import type { ModuleCli } from '@helios/shared/modules/registry'
import { createRequestContainer, type AppContainer } from '@helios/shared/lib/di/container'
import { randomUUID } from 'crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import { type Kysely, sql } from 'kysely'
import { Dictionary, DictionaryEntry, type DictionaryManagerVisibility } from '@helios/core/modules/dictionaries/data/entities'
import { installCustomEntitiesFromModules } from '@helios/core/modules/entities/lib/install-from-ce'
import type { CacheStrategy } from '@helios/cache/types'
import { ensureCustomFieldDefinitions } from '@helios/core/modules/entities/lib/field-definitions'
import { DefaultDataEngine, type DataEngine } from '@helios/shared/lib/data/engine'
import { E as CoreEntities } from '#generated/entities.ids.generated'
import { createProgressBar } from '@helios/shared/lib/cli/progress'
import { buildIndexDocument, type IndexCustomFieldValue } from '@helios/core/modules/query_index/lib/document'
import { parseBooleanToken } from '@helios/shared/lib/boolean'
import type { QueryEngine } from '@helios/shared/lib/query/types'
import type { EntityId } from '@helios/shared/modules/entities'
import {
  CustomerEntity,
  CustomerCompanyProfile,
  CustomerPersonProfile,
  CustomerDeal,
  CustomerDealPersonLink,
  CustomerDealCompanyLink,
  CustomerActivity,
  CustomerAddress,
  CustomerComment,
  CustomerInteraction,
  CustomerTodoLink,
  CustomerPipeline,
  CustomerPipelineStage,
  CustomerTag,
} from './data/entities'
import { ensureDictionaryEntry } from './commands/shared'
import { recomputeNextInteraction } from './lib/interactionProjection'
import {
  CUSTOMER_INTERACTION_ACTIVITY_ADAPTER_SOURCE,
  CUSTOMER_INTERACTION_TODO_ADAPTER_SOURCE,
} from './lib/interactionCompatibility'
import { CUSTOMER_CUSTHELIOS_FIELD_SETS } from './customFieldDefaults'

type SeedArgs = {
  tenantId: string
  organizationId: string
}

type DictionaryDefault = {
  value: string
  label: string
  color?: string
  icon?: string
}

type CustomFieldValuesPayload = Parameters<DataEngine['setCustomFields']>[0]['values']
type ProgressBarHandle = ReturnType<typeof createProgressBar>

export const DEAL_STATUS_DEFAULTS: DictionaryDefault[] = [
  { value: 'open', label: '跟进中', color: '#2563eb', icon: 'lucide:circle' },
  { value: 'closed', label: '已关闭', color: '#6b7280', icon: 'lucide:check-circle' },
  { value: 'win', label: '赢单', color: '#22c55e', icon: 'lucide:trophy' },
  { value: 'loose', label: '丢单', color: '#ef4444', icon: 'lucide:flag' },
  { value: 'in_progress', label: '推进中', color: '#f59e0b', icon: 'lucide:activity' },
]

export const PIPELINE_STAGE_DEFAULTS: DictionaryDefault[] = [
  { value: 'opportunity', label: '商机', color: '#38bdf8', icon: 'lucide:target' },
  { value: 'marketing_qualified_lead', label: '市场合格线索', color: '#a855f7', icon: 'lucide:sparkles' },
  { value: 'sales_qualified_lead', label: '销售合格线索', color: '#f97316', icon: 'lucide:users' },
  { value: 'offering', label: '方案报价', color: '#22c55e', icon: 'lucide:package' },
  { value: 'negotiations', label: '商务谈判', color: '#facc15', icon: 'lucide:handshake' },
  { value: 'win', label: '赢单', color: '#16a34a', icon: 'lucide:award' },
  { value: 'loose', label: '丢单', color: '#ef4444', icon: 'lucide:flag' },
  { value: 'stalled', label: '暂缓', color: '#6b7280', icon: 'lucide:alert-circle' },
]

export const ENTITY_STATUS_DEFAULTS: DictionaryDefault[] = [
  { value: 'active', label: '启用', color: '#22c55e', icon: 'lucide:user-check' },
  { value: 'inactive', label: '停用', color: '#94a3b8', icon: 'lucide:pause-circle' },
  { value: 'pending', label: '待确认', color: '#f59e0b', icon: 'lucide:clock' },
  { value: 'archived', label: '已归档', color: '#64748b', icon: 'lucide:archive' },
]

export const ENTITY_LIFECYCLE_STAGE_DEFAULTS: DictionaryDefault[] = [
  { value: 'lead', label: '线索', color: '#3b82f6', icon: 'lucide:sparkles' },
  { value: 'prospect', label: '意向客户', color: '#8b5cf6', icon: 'lucide:eye' },
  { value: 'customer', label: '正式客户', color: '#22c55e', icon: 'lucide:handshake' },
  { value: 'subscriber', label: '订阅用户', color: '#10b981', icon: 'lucide:bell' },
  { value: 'churned', label: '流失客户', color: '#ef4444', icon: 'lucide:user-x' },
  { value: 'other', label: '其他', color: '#94a3b8', icon: 'lucide:circle' },
]

export const ENTITY_SOURCE_DEFAULTS: DictionaryDefault[] = [
  { value: 'linkedin', label: '领英', color: '#0a66c2', icon: 'lucide:linkedin' },
  { value: 'email', label: '邮件', color: '#3b82f6', icon: 'lucide:mail' },
  { value: 'web_form', label: '官网表单', color: '#22c55e', icon: 'lucide:globe' },
  { value: 'referral', label: '转介', color: '#8b5cf6', icon: 'lucide:users' },
  { value: 'customer_referral', label: '老客转介', color: '#22c55e', icon: 'lucide:thumbs-up' },
  { value: 'partner_referral', label: '渠道转介', color: '#3b82f6', icon: 'lucide:handshake' },
  { value: 'event', label: '展会/活动', color: '#f59e0b', icon: 'lucide:calendar' },
  { value: 'cold_outreach', label: '外呼开拓', color: '#94a3b8', icon: 'lucide:phone' },
  { value: 'facebook', label: 'Facebook', color: '#1877f2', icon: 'lucide:facebook' },
  { value: 'typeform', label: '在线问卷', color: '#262627', icon: 'lucide:file-text' },
  { value: 'other', label: '其他', color: '#64748b', icon: 'lucide:circle' },
]

const ADDRESS_TYPE_DEFAULTS: DictionaryDefault[] = [
  { value: 'office', label: '办公地址', color: '#3b82f6', icon: 'lucide:building' },
  { value: 'work', label: '工作地址', color: '#6366f1', icon: 'lucide:briefcase' },
  { value: 'billing', label: '账单地址', color: '#f97316', icon: 'lucide:wallet' },
  { value: 'shipping', label: '收货地址', color: '#22c55e', icon: 'lucide:truck' },
  { value: 'home', label: '家庭地址', color: '#10b981', icon: 'lucide:map-pin' },
]

const ACTIVITY_TYPE_DEFAULTS: DictionaryDefault[] = [
  { value: 'call', label: '电话', color: '#2563eb', icon: 'lucide:phone-call' },
  { value: 'email', label: '邮件', color: '#16a34a', icon: 'lucide:mail' },
  { value: 'event', label: '活动', color: '#6366f1', icon: 'lucide:calendar' },
  { value: 'meeting', label: '会议', color: '#f59e0b', icon: 'lucide:users' },
  { value: 'note', label: '备注', color: '#a855f7', icon: 'lucide:notebook' },
  { value: 'task', label: '任务', color: '#ef4444', icon: 'lucide:check-square' },
]

export const INTERACTION_STATUS_DEFAULTS: DictionaryDefault[] = [
  { value: 'planned', label: '已计划', color: '#2563eb', icon: 'lucide:circle' },
  { value: 'in_progress', label: '进行中', color: '#f59e0b', icon: 'lucide:activity' },
  { value: 'waiting', label: '等待/阻塞', color: '#a855f7', icon: 'lucide:pause-circle' },
  { value: 'done', label: '已完成', color: '#22c55e', icon: 'lucide:check-circle' },
  { value: 'canceled', label: '已取消', color: '#6b7280', icon: 'lucide:x-circle' },
]

const JOB_TITLE_DEFAULTS: DictionaryDefault[] = [
  { value: '运营总监', label: '运营总监', color: '#f97316', icon: 'lucide:settings' },
  { value: '合伙业务副总', label: '合伙业务副总', color: '#6366f1', icon: 'lucide:users' },
  { value: '创始人兼首席设计师', label: '创始人兼首席设计师', color: '#ec4899', icon: 'lucide:star' },
  { value: '高级项目经理', label: '高级项目经理', color: '#0ea5e9', icon: 'lucide:clipboard-list' },
  { value: '销售负责人', label: '销售负责人', color: '#8b5cf6', icon: 'lucide:bar-chart-3' },
  { value: '零售合作总监', label: '零售合作总监', color: '#f59e0b', icon: 'lucide:shopping-bag' },
]

const INDUSTRY_DEFAULTS: DictionaryDefault[] = [
  { value: 'Renewable Energy', label: '新能源' },
  { value: 'Software', label: '软件' },
  { value: 'Interior Design', label: '室内设计' },
  { value: 'SaaS', label: 'SaaS' },
  { value: 'E-commerce', label: '电商' },
  { value: 'Healthcare', label: '医疗健康' },
  { value: 'Manufacturing', label: '制造业' },
  { value: 'Logistics', label: '物流' },
  { value: 'Financial Services', label: '金融服务' },
  { value: 'Retail', label: '零售' },
  { value: 'Hospitality', label: '酒店文旅' },
  { value: 'Energy', label: '能源' },
  { value: 'Media', label: '传媒' },
]

const TEMPERATURE_DEFAULTS: DictionaryDefault[] = [
  { value: 'hot', label: '高意向', color: '#ef4444', icon: 'lucide:flame' },
  { value: 'high', label: '较高', color: '#f59e0b', icon: 'lucide:trending-up' },
  { value: 'medium', label: '一般', color: '#8b5cf6', icon: 'lucide:sparkles' },
  { value: 'low', label: '较低', color: '#64748b', icon: 'lucide:clock' },
  { value: 'cold', label: '冷线索', color: '#94a3b8', icon: 'lucide:snowflake' },
]

const CUSTHELIOS_TAG_SEED_DEFAULTS = [
  { value: 'architecture', label: '建筑' },
  { value: 'hospitality', label: '酒店文旅' },
  { value: 'retail', label: '零售' },
  { value: 'healthcare', label: '医疗健康' },
  { value: 'tech', label: '科技' },
  { value: 'manufacturing', label: '制造' },
  { value: 'decision-maker', label: '决策人' },
  { value: 'influencer', label: '影响人' },
  { value: 'end-user', label: '最终用户' },
  { value: 'blocker', label: '阻力方' },
  { value: 'vip', label: '重点客户' },
  { value: 'strategic-account', label: '战略客户' },
  { value: 'reference-customer', label: '标杆客户' },
  { value: 'case-study-candidate', label: '案例候选' },
]

const PERSON_COMPANY_ROLE_DEFAULTS = [
  { value: 'decision_maker', label: '决策人', color: '#f59e0b', icon: 'lucide:crown' },
  { value: 'influencer', label: '影响人', color: '#8b5cf6', icon: 'lucide:sparkles' },
  { value: 'budget_holder', label: '预算负责人', color: '#3b82f6', icon: 'lucide:wallet' },
  { value: 'technical_evaluator', label: '技术评估人', color: '#22c55e', icon: 'lucide:wrench' },
  { value: 'primary_contact', label: '主对接人', color: '#0ea5e9', icon: 'lucide:star' },
  { value: 'end_user', label: '最终用户', color: '#64748b', icon: 'lucide:user' },
]

const PRIORITY_CURRENCIES = ['CNY', 'USD', 'EUR', 'HKD', 'GBP']

type ExampleAddress = {
  name?: string
  purpose?: string
  addressLine1: string
  addressLine2?: string
  city?: string
  region?: string
  postalCode?: string
  country?: string
  latitude?: number
  longitude?: number
  buildingNumber?: string
  flatNumber?: string
}

type ExamplePerson = {
  slug: string
  firstName: string
  lastName: string
  preferredName?: string
  jobTitle?: string
  department?: string
  seniority?: string
  email: string
  phone?: string
  timezone?: string
  linkedInUrl?: string
  twitterUrl?: string
  address?: ExampleAddress
  description?: string
  source?: string
  custom?: Record<string, unknown>
}

type ExampleDealParticipant = {
  slug: string
  participantRole?: string
}

type ExampleActivity = {
  slug: string
  entity: 'company' | 'person'
  personSlug?: string
  type: string
  subject?: string
  body?: string
  occurredAt: string
  icon?: string
  color?: string
  custom?: Record<string, unknown>
}

type ExampleNote = {
  entity: 'company' | 'person'
  personSlug?: string
  body: string
  occurredAt?: string
  icon?: string
  color?: string
}

type ExampleDeal = {
  slug: string
  title: string
  description?: string
  status: string
  pipelineStage?: string
  valueAmount?: number
  valueCurrency?: string
  probability?: number
  expectedCloseAt?: string
  people: ExampleDealParticipant[]
  activities?: ExampleActivity[]
  source?: string
  custom?: Record<string, unknown>
}

type ExampleCompany = {
  slug: string
  displayName: string
  legalName?: string
  brandName?: string
  industry?: string
  sizeBucket?: string
  domain?: string
  websiteUrl?: string
  description?: string
  primaryEmail?: string
  primaryPhone?: string
  source?: string
  lifecycleStage?: string
  status?: string
  annualRevenue?: number
  address?: ExampleAddress
  people?: ExamplePerson[]
  deals?: ExampleDeal[]
  interactions?: ExampleActivity[]
  notes?: ExampleNote[]
  custom?: Record<string, unknown>
}

const NOW = new Date()

function isoDaysFromNow(days: number, options?: { hour?: number; minute?: number }): string {
  const base = new Date(NOW)
  const hour = options?.hour ?? 12
  const minute = options?.minute ?? 0
  base.setUTCHours(hour, minute, 0, 0)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString()
}

export const CUSTOMER_EXAMPLES: ExampleCompany[] = [
  {
    slug: 'yangguang-lvneng',
    displayName: '阳光绿能科技',
    legalName: '阳光绿能科技有限公司',
    brandName: '阳光绿能',
    industry: 'Renewable Energy',
    sizeBucket: '51-200',
    domain: 'yangguang-energy.cn',
    websiteUrl: 'https://yangguang-energy.cn',
    description: '面向长三角多业主住宅与产业园区的分布式光伏与储能解决方案商。',
    primaryEmail: 'hello@yangguang-energy.cn',
    primaryPhone: '+86 21-5550-1480',
    source: 'partner_referral',
    lifecycleStage: 'customer',
    status: 'active',
    custom: {
      relationship_health: 'healthy',
      renewal_quarter: 'Q3',
      executive_notes: '业主满意度高；正评估 2026 年储能捆绑增购预算。',
      customer_marketing_case: true,
    },
    address: {
      name: '上海总部',
      purpose: 'office',
      addressLine1: '浦东新区世纪大道 88 号 18 楼',
      city: '上海',
      region: '上海',
      postalCode: '200120',
      country: 'CN',
      latitude: 31.2354,
      longitude: 121.5055,
    },
    people: [
      {
        slug: 'li-na',
        firstName: '李娜',
        lastName: '',
        preferredName: '李娜',
        jobTitle: '运营总监',
        department: '运营',
        seniority: 'director',
        email: 'li.na@yangguang-energy.cn',
        phone: '+86 138-1550-0162',
        timezone: 'Asia/Shanghai',
        source: 'partner_referral',
        custom: {
          buying_role: 'champion',
          preferred_pronouns: 'she/her',
          newsletter_opt_in: true,
        },
        address: {
          purpose: 'work',
          addressLine1: '浦东新区世纪大道 88 号 18 楼',
          city: '上海',
          region: '上海',
          postalCode: '200120',
          country: 'CN',
        },
      },
      {
        slug: 'chen-hao',
        firstName: '陈浩',
        lastName: '',
        jobTitle: '合伙业务副总',
        department: '商务拓展',
        seniority: 'vp',
        email: 'chen.hao@yangguang-energy.cn',
        phone: '+86 139-1550-0199',
        timezone: 'Asia/Shanghai',
        source: 'cold_outreach',
        custom: {
          buying_role: 'economic_buyer',
          preferred_pronouns: 'he/him',
          newsletter_opt_in: false,
        },
      },
    ],
    deals: [
      {
        slug: 'lvcheng-residences',
        title: '绿城住宅光伏整装',
        description: '40 户分布式光伏安装，含三年运维服务包。',
        status: 'in_progress',
        pipelineStage: 'negotiations',
        valueAmount: 1280000,
        valueCurrency: 'CNY',
        expectedCloseAt: isoDaysFromNow(45),
        probability: 55,
        source: 'partner_referral',
        custom: {
          competitive_risk: 'medium',
          implementation_complexity: 'standard',
          estimated_seats: 40,
          requires_legal_review: true,
        },
        people: [
          { slug: 'li-na', participantRole: '项目发起人' },
          { slug: 'chen-hao', participantRole: '商务负责人' },
        ],
        activities: [
          {
            slug: 'lvcheng-hoa-follow-up',
            entity: 'company',
            type: 'call',
            subject: '跟进业委会融资方案',
            body: '梳理了融资方案与运维服务档位，供业委会下次会议表决。',
            occurredAt: isoDaysFromNow(-9, { hour: 17, minute: 30 }),
            icon: 'lucide:phone-call',
            color: '#2563eb',
            custom: {
              engagement_sentiment: 'positive',
              shared_with_leadership: true,
              follow_up_owner: '周倩',
            },
          },
          {
            slug: 'lvcheng-case-studies',
            entity: 'person',
            personSlug: 'li-na',
            type: 'note',
            subject: '发送案例资料',
            body: '发送两份同类小区案例，平均电费降幅约 18%。',
            occurredAt: isoDaysFromNow(-7, { hour: 19, minute: 15 }),
            icon: 'lucide:notebook',
            color: '#a855f7',
            custom: {
              engagement_sentiment: 'positive',
              shared_with_leadership: false,
              follow_up_owner: '陈浩',
            },
          },
        ],
      },
      {
        slug: 'jiangjing-battery',
        title: '江景公寓储能升级',
        description: '为已有光伏客户加装储能，延长夜间供电覆盖。',
        status: 'open',
        pipelineStage: 'offering',
        valueAmount: 560000,
        valueCurrency: 'CNY',
        expectedCloseAt: isoDaysFromNow(65),
        probability: 40,
        source: 'web_form',
        custom: {
          competitive_risk: 'high',
          implementation_complexity: 'complex',
          estimated_seats: 28,
          requires_legal_review: false,
        },
        people: [{ slug: 'li-na', participantRole: '对接人' }],
        activities: [
          {
            slug: 'jiangjing-energy-audit',
            entity: 'company',
            type: 'meeting',
            subject: '完成现场能源审计',
            body: '审计发现 28 户逆变器固件需升级，完成后才能发运储能设备。',
            occurredAt: isoDaysFromNow(-17, { hour: 21 }),
            icon: 'lucide:users',
            color: '#f59e0b',
            custom: {
              engagement_sentiment: 'neutral',
              shared_with_leadership: false,
              follow_up_owner: '李娜',
            },
          },
        ],
      },
    ],
    interactions: [
      {
        slug: 'yangguang-nps-email',
        entity: 'company',
        type: 'email',
        subject: '发送季度满意度问卷',
        body: '向组合物业经理发送 Q2 满意度问卷。',
        occurredAt: isoDaysFromNow(-20, { hour: 16 }),
        icon: 'lucide:mail',
        color: '#16a34a',
        custom: {
          engagement_sentiment: 'positive',
          shared_with_leadership: false,
          follow_up_owner: '客户成功团队',
        },
      },
    ],
    notes: [
      {
        entity: 'company',
        body: '已完成 12 个小区能源审计，正在评估运维打包增值方案。',
        occurredAt: isoDaysFromNow(-11, { hour: 18 }),
        icon: 'lucide:lightbulb',
        color: '#facc15',
      },
      {
        entity: 'person',
        personSlug: 'li-na',
        body: '李娜希望在业委会表决前拿到融资方案对比材料。',
        occurredAt: isoDaysFromNow(-9, { hour: 15, minute: 30 }),
        icon: 'lucide:bookmark',
        color: '#a855f7',
      },
    ],
  },
  {
    slug: 'zhihai-shuke',
    displayName: '智海数科',
    legalName: '杭州智海数字科技有限公司',
    brandName: '智海数科',
    industry: 'Software',
    sizeBucket: '201-500',
    domain: 'zhihai-data.cn',
    websiteUrl: 'https://zhihai-data.cn',
    description: '帮助消费品牌优化商品陈列与补货决策的零售数据分析平台。',
    primaryEmail: 'info@zhihai-data.cn',
    primaryPhone: '+86 571-5550-0024',
    source: 'event',
    lifecycleStage: 'prospect',
    status: 'active',
    custom: {
      relationship_health: 'monitor',
      renewal_quarter: 'Q4',
      executive_notes: '试点指标向好；财务负责人要求先出 ROI 测算再扩店。',
      customer_marketing_case: false,
    },
    address: {
      name: '杭州总部',
      purpose: 'office',
      addressLine1: '西湖区文三路 478 号华星时代广场 B 座 12 层',
      city: '杭州',
      region: '浙江',
      postalCode: '310012',
      country: 'CN',
      latitude: 30.2786,
      longitude: 120.1307,
    },
    people: [
      {
        slug: 'wang-lei',
        firstName: '王磊',
        lastName: '',
        jobTitle: '销售负责人',
        department: '营收',
        seniority: 'c-level',
        email: 'wang.lei@zhihai-data.cn',
        phone: '+86 137-1550-0168',
        timezone: 'Asia/Shanghai',
        source: 'event',
        custom: {
          buying_role: 'economic_buyer',
          preferred_pronouns: 'he/him',
          newsletter_opt_in: true,
        },
      },
      {
        slug: 'zhao-min',
        firstName: '赵敏',
        lastName: '',
        jobTitle: '零售合作总监',
        department: '合作伙伴',
        seniority: 'director',
        email: 'zhao.min@zhihai-data.cn',
        phone: '+86 136-1550-0179',
        timezone: 'Asia/Shanghai',
        source: 'event',
        custom: {
          buying_role: 'champion',
          preferred_pronouns: 'she/her',
          newsletter_opt_in: true,
        },
      },
    ],
    deals: [
      {
        slug: 'lanwan-pilot',
        title: '蓝湾超市试点项目',
        description: '覆盖 28 家门店的商品陈列分析半年试点。',
        status: 'win',
        pipelineStage: 'win',
        valueAmount: 680000,
        valueCurrency: 'CNY',
        expectedCloseAt: isoDaysFromNow(-25),
        probability: 100,
        source: 'event',
        custom: {
          competitive_risk: 'low',
          implementation_complexity: 'standard',
          estimated_seats: 28,
          requires_legal_review: false,
        },
        people: [
          { slug: 'wang-lei', participantRole: '商务负责人' },
          { slug: 'zhao-min', participantRole: '客户负责人' },
        ],
        activities: [
          {
            slug: 'lanwan-contract',
            entity: 'company',
            type: 'meeting',
            subject: '采购已签署合同',
            body: '采购已签 SOW；下周二安排上线启动会。',
            occurredAt: isoDaysFromNow(-28, { hour: 14, minute: 30 }),
            icon: 'lucide:handshake',
            color: '#22c55e',
            custom: {
              engagement_sentiment: 'positive',
              shared_with_leadership: true,
              follow_up_owner: '赵敏',
            },
          },
          {
            slug: 'lanwan-onboarding-email',
            entity: 'person',
            personSlug: 'zhao-min',
            type: 'email',
            subject: '发送上线清单',
            body: '发送数据导出与收银系统对接清单，覆盖上线所需事项。',
            occurredAt: isoDaysFromNow(-27, { hour: 13, minute: 5 }),
            icon: 'lucide:mail',
            color: '#16a34a',
            custom: {
              engagement_sentiment: 'positive',
              shared_with_leadership: false,
              follow_up_owner: '实施团队',
            },
          },
        ],
      },
      {
        slug: 'huazhong-chain',
        title: '华中连锁拓展',
        description: '覆盖华中地区约 120 家门店的扩展机会。',
        status: 'open',
        pipelineStage: 'opportunity',
        valueAmount: 1480000,
        valueCurrency: 'CNY',
        expectedCloseAt: isoDaysFromNow(120),
        probability: 35,
        source: 'cold_outreach',
        custom: {
          competitive_risk: 'medium',
          implementation_complexity: 'complex',
          estimated_seats: 120,
          requires_legal_review: true,
        },
        people: [{ slug: 'zhao-min', participantRole: '客户负责人' }],
        activities: [
          {
            slug: 'huazhong-forecasting-call',
            entity: 'company',
            type: 'call',
            subject: '介绍需求预测模块',
            body: '与运营与财务负责人演示需求预测模块。',
            occurredAt: isoDaysFromNow(-14, { hour: 15, minute: 45 }),
            icon: 'lucide:phone-call',
            color: '#2563eb',
            custom: {
              engagement_sentiment: 'positive',
              shared_with_leadership: true,
              follow_up_owner: '王磊',
            },
          },
        ],
      },
    ],
    interactions: [
      {
        slug: 'zhihai-pricing-note',
        entity: 'person',
        personSlug: 'wang-lei',
        type: 'note',
        subject: '索要报价对比',
        body: '王磊希望在董事会前拿到与竞品的报价对比。',
        occurredAt: isoDaysFromNow(-18, { hour: 12, minute: 10 }),
        icon: 'lucide:notebook',
        color: '#a855f7',
        custom: {
          engagement_sentiment: 'neutral',
          shared_with_leadership: true,
          follow_up_owner: '财务团队',
        },
      },
    ],
    notes: [
      {
        entity: 'company',
        body: '试点成果已汇报董事会；是否扩店取决于 Q4 预算评审。',
        occurredAt: isoDaysFromNow(-16, { hour: 17, minute: 45 }),
        icon: 'lucide:bar-chart-3',
        color: '#38bdf8',
      },
      {
        entity: 'person',
        personSlug: 'zhao-min',
        body: '赵敏确认数据团队可在两周内提供收银导出。',
        occurredAt: isoDaysFromNow(-13, { hour: 11, minute: 20 }),
        icon: 'lucide:clipboard-list',
        color: '#0ea5e9',
      },
    ],
  },
  {
    slug: 'qingtong-design',
    displayName: '青桐设计',
    legalName: '成都青桐室内设计有限公司',
    brandName: '青桐设计',
    industry: 'Interior Design',
    sizeBucket: '11-50',
    domain: 'qingtong.design',
    websiteUrl: 'https://qingtong.design',
    description: '专注酒店与精品零售空间的室内设计工作室，项目覆盖西南与长三角。',
    primaryEmail: 'studio@qingtong.design',
    primaryPhone: '+86 28-5550-0456',
    source: 'customer_referral',
    lifecycleStage: 'customer',
    status: 'active',
    custom: {
      relationship_health: 'healthy',
      renewal_quarter: 'Q1',
      executive_notes: '口碑转介稳定；可向业主方分享可持续材料案例。',
      customer_marketing_case: true,
    },
    address: {
      name: '成都工作室',
      purpose: 'office',
      addressLine1: '高新区天府大道北段 1700 号环球中心 W2 座 2207',
      city: '成都',
      region: '四川',
      postalCode: '610041',
      country: 'CN',
      latitude: 30.5728,
      longitude: 104.0665,
    },
    people: [
      {
        slug: 'zhou-ran',
        firstName: '周然',
        lastName: '',
        jobTitle: '创始人兼首席设计师',
        department: '管理层',
        seniority: 'c-level',
        email: 'zhou.ran@qingtong.design',
        phone: '+86 135-1550-0489',
        timezone: 'Asia/Shanghai',
        source: 'customer_referral',
        custom: {
          buying_role: 'economic_buyer',
          preferred_pronouns: 'they/them',
          newsletter_opt_in: false,
        },
      },
      {
        slug: 'liu-xiaoxuan',
        firstName: '刘晓萱',
        lastName: '',
        jobTitle: '高级项目经理',
        department: '项目部',
        seniority: 'manager',
        email: 'liu.xiaoxuan@qingtong.design',
        phone: '+86 186-1550-0521',
        timezone: 'Asia/Shanghai',
        source: 'customer_referral',
        custom: {
          buying_role: 'influencer',
          preferred_pronouns: 'she/her',
          newsletter_opt_in: true,
        },
      },
    ],
    deals: [
      {
        slug: 'mansu-renovation',
        title: '漫宿精品酒店翻新',
        description: '漫宿酒店集团大堂与客房套间整体改造。',
        status: 'in_progress',
        pipelineStage: 'sales_qualified_lead',
        valueAmount: 980000,
        valueCurrency: 'CNY',
        expectedCloseAt: isoDaysFromNow(35),
        probability: 65,
        source: 'customer_referral',
        custom: {
          competitive_risk: 'medium',
          implementation_complexity: 'complex',
          estimated_seats: 12,
          requires_legal_review: true,
        },
        people: [
          { slug: 'zhou-ran', participantRole: '首席设计师' },
          { slug: 'liu-xiaoxuan', participantRole: '项目经理' },
        ],
        activities: [
          {
            slug: 'mansu-workshop-recap',
            entity: 'person',
            personSlug: 'liu-xiaoxuan',
            type: 'meeting',
            subject: '设计工作坊纪要',
            body: '整理现场工作坊中灯光与材料反馈。',
            occurredAt: isoDaysFromNow(-6, { hour: 20 }),
            icon: 'lucide:users',
            color: '#f59e0b',
            custom: {
              engagement_sentiment: 'positive',
              shared_with_leadership: false,
              follow_up_owner: '刘晓萱',
            },
          },
        ],
      },
      {
        slug: 'wutong-retreat',
        title: '梧桐山庄康养中心扩建',
        description: '新建康养中心，含零售区与理疗室。',
        status: 'loose',
        pipelineStage: 'loose',
        valueAmount: 720000,
        valueCurrency: 'CNY',
        expectedCloseAt: isoDaysFromNow(-70),
        probability: 0,
        source: 'customer_referral',
        custom: {
          competitive_risk: 'high',
          implementation_complexity: 'standard',
          estimated_seats: 8,
          requires_legal_review: false,
        },
        people: [{ slug: 'zhou-ran', participantRole: '首席设计师' }],
        activities: [
          {
            slug: 'wutong-loss-note',
            entity: 'company',
            type: 'note',
            subject: '因预算落选',
            body: '对方选择了主打装配式内装的低价方案。',
            occurredAt: isoDaysFromNow(-68, { hour: 18, minute: 45 }),
            icon: 'lucide:alert-circle',
            color: '#ef4444',
            custom: {
              engagement_sentiment: 'negative',
              shared_with_leadership: true,
              follow_up_owner: '周然',
            },
          },
        ],
      },
    ],
    interactions: [
      {
        slug: 'qingtong-referral-call',
        entity: 'company',
        type: 'call',
        subject: '由远见酒店集团转介',
        body: '成都项目交付后，由远见酒店集团转介而来。',
        occurredAt: isoDaysFromNow(-25, { hour: 16, minute: 45 }),
        icon: 'lucide:phone',
        color: '#2563eb',
        custom: {
          engagement_sentiment: 'positive',
          shared_with_leadership: true,
          follow_up_owner: '周然',
        },
      },
    ],
    notes: [
      {
        entity: 'company',
        body: '客户希望下次现场勘察时一起看可持续材料样板库。',
        occurredAt: isoDaysFromNow(-22, { hour: 19, minute: 10 }),
        icon: 'lucide:lightbulb',
        color: '#22c55e',
      },
      {
        entity: 'person',
        personSlug: 'liu-xiaoxuan',
        body: '刘晓萱希望在向业主汇报前更新家具软装预算。',
        occurredAt: isoDaysFromNow(-6, { hour: 21, minute: 5 }),
        icon: 'lucide:clipboard-list',
        color: '#0ea5e9',
      },
    ],
  },
]

const STRESS_TEST_SOURCE = 'stress_test'
const STRESS_TEST_FIRST_NAMES = [
  'Alex',
  'Jordan',
  'Taylor',
  'Morgan',
  'Casey',
  'Riley',
  'Hayden',
  'Skyler',
  'Quinn',
  'Peyton',
  'Harper',
  'Rowan',
  'Sawyer',
  'Avery',
  'Reese',
]
const STRESS_TEST_LAST_NAMES = [
  'Rivera',
  'Chen',
  'Nguyen',
  'Harper',
  'Ellis',
  'Patel',
  'Khan',
  'Silva',
  'Lopez',
  'Murphy',
  'Baker',
  'Diaz',
  'Foster',
  'Gonzalez',
  'Kim',
]
const STRESS_TEST_JOB_TITLES = [
  'Account Executive',
  'Growth Manager',
  'Customer Success Lead',
  'Operations Specialist',
  'Procurement Analyst',
  'Demand Generation Manager',
  'Solutions Consultant',
  'Revenue Operations Partner',
  'Implementation Manager',
  'Sales Engineer',
]
const STRESS_TEST_DEPARTMENTS = [
  'Revenue',
  'Operations',
  'Customer Experience',
  'Procurement',
  'Strategy',
  'Marketing',
  'Sales',
]
const STRESS_TEST_SENIORITY = ['junior', 'mid', 'senior', 'lead', 'director']
const STRESS_TEST_TIMEZONES = [
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/Berlin',
  'Europe/Warsaw',
  'Europe/London',
  'Asia/Singapore',
]
const STRESS_TEST_COMPANY_PREFIX = [
  'Atlas',
  'Northwind',
  'Summit',
  'Vertex',
  'Harbor',
  'Cobalt',
  'Juniper',
  'Orion',
  'Beacon',
  'Silverline',
  'Brightside',
  'Evergreen',
  'Lakeshore',
  'Bluefield',
  'Aurora',
]
const STRESS_TEST_COMPANY_SUFFIX = ['Industries', 'Partners', 'Holdings', 'Collective', 'Group', 'Ventures']
const STRESS_TEST_INDUSTRIES = [
  'SaaS',
  'E-commerce',
  'Healthcare',
  'Manufacturing',
  'Logistics',
  'Financial Services',
  'Retail',
  'Hospitality',
  'Energy',
  'Media',
]
const STRESS_TEST_SIZE_BUCKETS = ['1-10', '11-50', '51-200', '201-500', '500+']
const STRESS_TEST_EMAIL_DOMAIN = 'stress.test'
const STRESS_TEST_BUYING_ROLES = ['economic_buyer', 'champion', 'technical_evaluator', 'influencer']
const STRESS_TEST_PRONOUNS = ['they/them', 'she/her', 'he/him']
const STRESS_TEST_RELATIONSHIP_HEALTH = ['healthy', 'monitor', 'at_risk']
const STRESS_TEST_RENEWAL_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
const STRESS_TEST_ACTIVITY_SENTIMENT = ['positive', 'neutral', 'negative']
const STRESS_TEST_ACTIVITY_OWNERS = [
  'Jordan Lane',
  'Alex Rivers',
  'Morgan Ellis',
  'Taylor Chen',
  'Casey Ortega',
  'Riley Summers',
]
const STRESS_TEST_DEAL_ACTIVITY_TYPES = ACTIVITY_TYPE_DEFAULTS.map((entry) => entry.value)
const STRESS_TEST_DEAL_STATUSES = DEAL_STATUS_DEFAULTS.map((entry) => entry.value)
const STRESS_TEST_DEAL_PIPELINE = PIPELINE_STAGE_DEFAULTS.map((entry) => entry.value)
const STRESS_TEST_DEAL_CUSTOMER_ROLES = ['evaluation lead', 'decision maker', 'influencer', 'sponsor']
const STRESS_TEST_DEAL_RISK = ['low', 'medium', 'high']
const STRESS_TEST_IMPLEMENTATION = ['light', 'standard', 'complex']
const STRESS_TEST_ACTIVITY_ICONS = ['lucide:phone-call', 'lucide:mail', 'lucide:calendar', 'lucide:users']
const STRESS_TEST_ACTIVITY_SUBJECTS = [
  'Discovery call',
  'Quarterly business review',
  'Implementation planning',
  'Renewal alignment',
  'Expansion pitch',
  'Stakeholder sync',
  'Onboarding follow-up',
]
const STRESS_TEST_ACTIVITY_BODIES = [
  'Reviewed account metrics and confirmed action plan for next quarter.',
  'Aligned on implementation milestones and risk mitigation.',
  'Shared updated proposal and captured feedback from stakeholders.',
  'Clarified contract terms and renewal incentives.',
  'Coordinated pilot scope with the core project team.',
  'Captured next steps for executive briefing.',
]
const STRESS_TEST_NOTE_SNIPPETS = [
  'Customer excited about roadmap items for Q3.',
  'Need to loop in billing once pricing draft is approved.',
  'Leadership wants a success story before expansion.',
  'Security questionnaire still pending from customer.',
  'Plan to introduce CS lead during next onsite visit.',
  'Team asked for sandbox access for analytics squad.',
]

function toAmount(value?: number): string | null {
  if (typeof value !== 'number') return null
  return value.toFixed(2)
}

function randomChoice<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function slugifyValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(?:^-+|-+$)/g, '')
}

function buildPhone(index: number): string {
  const block = String(400 + (index % 500)).padStart(3, '0')
  const last = String(1000 + (index % 9000)).slice(0, 4)
  return `+1-555-${block}-${last}`
}

function randomPastDate(maxDaysOffset: number): Date {
  const now = Date.now()
  const days = Math.random() * Math.max(1, maxDaysOffset)
  const ms = days * 24 * 60 * 60 * 1000
  return new Date(now - ms)
}

function randomFutureDate(maxDaysOffset: number): Date {
  const now = Date.now()
  const days = Math.random() * Math.max(1, maxDaysOffset)
  const ms = days * 24 * 60 * 60 * 1000
  return new Date(now + ms)
}

type ProgressInfo = {
  completed: number
  total: number
}

type ProgressCallback = (info: ProgressInfo) => void

type StressTestOptions = {
  count: number
  onProgress?: ProgressCallback
  includeExtras?: boolean
}

function parseArgs(rest: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (let i = 0; i < rest.length; i += 1) {
    const part = rest[i]
    if (!part?.startsWith('--')) continue
    const [keyRaw, valueRaw] = part.slice(2).split('=')
    if (keyRaw) {
      if (valueRaw !== undefined) args[keyRaw] = valueRaw
      else if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) args[keyRaw] = rest[i + 1]
      else args[keyRaw] = 'true'
    }
  }
  return args
}

async function seedCustomerDictionaries(em: EntityManager, { tenantId, organizationId }: SeedArgs) {
  for (const entry of ENTITY_STATUS_DEFAULTS) {
    await ensureDictionaryEntry(em, {
      tenantId,
      organizationId,
      kind: 'status',
      value: entry.value,
      label: entry.label,
      color: entry.color,
      icon: entry.icon,
    })
  }
  for (const entry of ENTITY_LIFECYCLE_STAGE_DEFAULTS) {
    await ensureDictionaryEntry(em, {
      tenantId,
      organizationId,
      kind: 'lifecycle_stage',
      value: entry.value,
      label: entry.label,
      color: entry.color,
      icon: entry.icon,
    })
  }
  for (const entry of ENTITY_SOURCE_DEFAULTS) {
    await ensureDictionaryEntry(em, {
      tenantId,
      organizationId,
      kind: 'source',
      value: entry.value,
      label: entry.label,
      color: entry.color,
      icon: entry.icon,
    })
  }
  for (const entry of ADDRESS_TYPE_DEFAULTS) {
    await ensureDictionaryEntry(em, {
      tenantId,
      organizationId,
      kind: 'address_type',
      value: entry.value,
      label: entry.label,
      color: entry.color,
      icon: entry.icon,
    })
  }
  for (const entry of ACTIVITY_TYPE_DEFAULTS) {
    await ensureDictionaryEntry(em, {
      tenantId,
      organizationId,
      kind: 'activity_type',
      value: entry.value,
      label: entry.label,
      color: entry.color,
      icon: entry.icon,
    })
  }
  for (const entry of INTERACTION_STATUS_DEFAULTS) {
    await ensureDictionaryEntry(em, {
      tenantId,
      organizationId,
      kind: 'interaction_status',
      value: entry.value,
      label: entry.label,
      color: entry.color,
      icon: entry.icon,
    })
  }
  for (const entry of JOB_TITLE_DEFAULTS) {
    await ensureDictionaryEntry(em, {
      tenantId,
      organizationId,
      kind: 'job_title',
      value: entry.value,
      label: entry.label,
      color: entry.color,
      icon: entry.icon,
    })
  }
  for (const entry of DEAL_STATUS_DEFAULTS) {
    await ensureDictionaryEntry(em, {
      tenantId,
      organizationId,
      kind: 'deal_status',
      value: entry.value,
      label: entry.label,
      color: entry.color,
      icon: entry.icon,
    })
  }
  for (const entry of PIPELINE_STAGE_DEFAULTS) {
    await ensureDictionaryEntry(em, {
      tenantId,
      organizationId,
      kind: 'pipeline_stage',
      value: entry.value,
      label: entry.label,
      color: entry.color,
      icon: entry.icon,
    })
  }
  for (const entry of INDUSTRY_DEFAULTS) {
    await ensureDictionaryEntry(em, {
      tenantId,
      organizationId,
      kind: 'industry',
      value: entry.value,
      label: entry.label,
      color: entry.color,
      icon: entry.icon,
    })
  }
  for (const entry of TEMPERATURE_DEFAULTS) {
    await ensureDictionaryEntry(em, {
      tenantId,
      organizationId,
      kind: 'temperature',
      value: entry.value,
      label: entry.label,
      color: entry.color,
      icon: entry.icon,
    })
  }
  // Renewal quarters: current year + 2 future years
  const currentYear = new Date().getFullYear()
  for (let year = currentYear; year <= currentYear + 2; year++) {
    for (const q of [1, 2, 3, 4]) {
      await ensureDictionaryEntry(em, {
        tenantId,
        organizationId,
        kind: 'renewal_quarter',
        value: `${year}_q${q}`,
        label: `Q${q} ${year}`,
        color: '#94a3b8',
        icon: 'lucide:calendar',
      })
    }
  }
  // Uses raw em.find/em.findOne — entities queried here have no encrypted fields as of this commit.
  // Migrate to findOneWithDecryption / findWithDecryption when any of them gain an @Encrypted column.
  // Custom tags (free-pool labels)
  for (const entry of CUSTHELIOS_TAG_SEED_DEFAULTS) {
    const slug = entry.value
    const existing = await em.findOne(CustomerTag, {
      tenantId,
      organizationId,
      slug,
    })
    if (!existing) {
      em.persist(em.create(CustomerTag, {
        tenantId,
        organizationId,
        slug,
        label: entry.label,
      }))
    } else if (existing.label !== entry.label) {
      existing.label = entry.label
      em.persist(existing)
    }
  }
  await em.flush()
  for (const entry of PERSON_COMPANY_ROLE_DEFAULTS) {
    await ensureDictionaryEntry(em, {
      tenantId, organizationId,
      kind: 'person_company_role',
      value: entry.value, label: entry.label, color: entry.color, icon: entry.icon,
    })
  }
}

function resolveCurrencyCodes(): string[] {
  const normalizedPriority = PRIORITY_CURRENCIES.map((code) => code.toUpperCase())
  const intlWithSupportedValues = Intl as typeof Intl & {
    supportedValuesOf?: (input: 'currency') => string[]
  }
  const supported: string[] =
    typeof intlWithSupportedValues.supportedValuesOf === 'function'
      ? intlWithSupportedValues.supportedValuesOf('currency')
      : []
  const normalizedSupported = supported
    .map((code) => code.toUpperCase())
    .filter((code) => /^[A-Z]{3}$/.test(code))
  const uniqueSupported: string[] = []
  const seen = new Set<string>(normalizedPriority)
  for (const code of normalizedSupported) {
    if (seen.has(code)) continue
    seen.add(code)
    uniqueSupported.push(code)
  }
  if (!uniqueSupported.length) {
    console.warn('[customers.cli] Intl.supportedValuesOf("currency") unavailable; seeding minimal currency list.')
    return normalizedPriority
  }
  uniqueSupported.sort((a, b) => a.localeCompare(b))
  return [...normalizedPriority, ...uniqueSupported]
}

function resolveCurrencyLabel(code: string): string {
  try {
    const intlWithDisplayNames = Intl as typeof Intl & {
      DisplayNames?: new (locales: string[], options: { type: 'currency' }) => {
        of(value: string): string | undefined
      }
    }
    if (typeof intlWithDisplayNames.DisplayNames === 'function') {
      const displayNames = new intlWithDisplayNames.DisplayNames(['en'], { type: 'currency' })
      const label = displayNames.of(code)
      if (typeof label === 'string' && label.trim().length) {
        return `${code} – ${label}`
      }
    }
  } catch (err) {
    console.warn('[customers.cli] Unable to resolve currency label for', code, err)
  }
  return code
}

async function seedCurrencyDictionary(em: EntityManager, { tenantId, organizationId }: SeedArgs) {
  let dictionary = await em.findOne(Dictionary, {
    tenantId,
    organizationId,
    key: 'currency',
    deletedAt: null,
  })
  if (!dictionary) {
    dictionary = em.create(Dictionary, {
      key: 'currency',
      name: 'Currencies',
      description: 'ISO 4217 currencies',
      tenantId,
      organizationId,
      isSystem: true,
      isActive: true,
      managerVisibility: 'default' satisfies DictionaryManagerVisibility,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(dictionary)
    await em.flush()
  }

  const existingEntries = await em.find(DictionaryEntry, {
    dictionary,
    tenantId,
    organizationId,
  })
  const existingMap = new Map<string, DictionaryEntry>()
  existingEntries.forEach((entry) => existingMap.set(entry.value.toUpperCase(), entry))

  const currencyCodes = resolveCurrencyCodes()
  for (const code of currencyCodes) {
    const upper = code.toUpperCase()
    const normalizedValue = upper.toLowerCase()
    const label = resolveCurrencyLabel(upper)
    const current = existingMap.get(upper)
    if (current) {
      if (current.label !== label) {
        current.label = label
        current.updatedAt = new Date()
        em.persist(current)
      }
      continue
    }
    const entry = em.create(DictionaryEntry, {
      dictionary,
      tenantId,
      organizationId,
      value: upper,
      normalizedValue,
      label,
      color: null,
      icon: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(entry)
  }
}

async function seedCustomerExamples(
  em: EntityManager,
  container: AppContainer,
  { tenantId, organizationId }: SeedArgs
): Promise<boolean> {
  const exampleDealTitles = Array.from(
    new Set(
      CUSTOMER_EXAMPLES.flatMap((company) =>
        (company.deals ?? []).map((deal) => deal.title).filter((title): title is string => typeof title === 'string')
      )
    )
  )
  if (exampleDealTitles.length > 0) {
    const already = await em.count(CustomerDeal, {
      tenantId,
      organizationId,
      title: { $in: exampleDealTitles as any },
    })
    if (already > 0) {
      return false
    }
  }

  await seedCustomerDictionaries(em, { tenantId, organizationId })

  const seededIndustryValues = new Set(
    CUSTOMER_EXAMPLES.map((company) => (typeof company.industry === 'string' ? company.industry.trim() : ''))
      .filter((value): value is string => value.length > 0)
  )
  for (const value of seededIndustryValues) {
    await ensureDictionaryEntry(em, {
      tenantId,
      organizationId,
      kind: 'industry',
      value,
      label: value,
    })
  }

  let cache: CacheStrategy | null = null
  if (typeof (container as any).hasRegistration === 'function' && container.hasRegistration('cache')) {
    try {
      cache = (container.resolve('cache') as CacheStrategy)
    } catch {
      cache = null
    }
  }
  try {
    await installCustomEntitiesFromModules(em, cache, {
      tenantIds: [tenantId],
      includeGlobal: false,
      dryRun: false,
      logger: () => {},
    })
  } catch (err) {
    console.warn('[customers.cli] Failed to install custom entities before seeding examples', err)
  }

  try {
    await ensureCustomerCustomFieldDefinitions(em, tenantId)
  } catch (err) {
    console.warn('[customers.cli] Failed to ensure customer custom field definitions', err)
  }

  const dataEngine = new DefaultDataEngine(em, container)
  const customFieldAssignments: Array<() => Promise<void>> = []

  const companyEntities = new Map<string, CustomerEntity>()
  const personEntities = new Map<string, CustomerEntity>()

  for (const company of CUSTOMER_EXAMPLES) {
    const companyEntity = em.create(CustomerEntity, {
      organizationId,
      tenantId,
      kind: 'company',
      displayName: company.displayName,
      description: company.description ?? null,
      primaryEmail: company.primaryEmail ?? null,
      primaryPhone: company.primaryPhone ?? null,
      lifecycleStage: company.lifecycleStage ?? null,
      status: company.status ?? null,
      source: company.source ?? null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const companyProfile = em.create(CustomerCompanyProfile, {
      organizationId,
      tenantId,
      entity: companyEntity,
      legalName: company.legalName ?? null,
      brandName: company.brandName ?? null,
      domain: company.domain ?? null,
      websiteUrl: company.websiteUrl ?? null,
      industry: typeof company.industry === 'string' ? company.industry.trim() || null : null,
      sizeBucket: company.sizeBucket ?? null,
      annualRevenue: typeof company.annualRevenue === 'number' ? toAmount(company.annualRevenue) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(companyEntity)
    em.persist(companyProfile)

    if (company.custom && Object.keys(company.custom).length) {
      const values = { ...company.custom } as CustomFieldValuesPayload
      customFieldAssignments.push(async () =>
        dataEngine.setCustomFields({
          entityId: CoreEntities.customers.customer_company_profile,
          recordId: companyProfile.id,
          organizationId,
          tenantId,
          values,
        })
      )
    }

    if (company.address?.addressLine1) {
      const address = em.create(CustomerAddress, {
        organizationId,
        tenantId,
        entity: companyEntity,
        name: company.address.name ?? null,
        purpose: company.address.purpose ?? 'office',
        addressLine1: company.address.addressLine1,
        addressLine2: company.address.addressLine2 ?? null,
        city: company.address.city ?? null,
        region: company.address.region ?? null,
        postalCode: company.address.postalCode ?? null,
        country: company.address.country ?? null,
        latitude: company.address.latitude ?? null,
        longitude: company.address.longitude ?? null,
        buildingNumber: company.address.buildingNumber ?? null,
        flatNumber: company.address.flatNumber ?? null,
        isPrimary: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      em.persist(address)
    }

    companyEntities.set(company.slug, companyEntity)

    for (const person of company.people ?? []) {
      const nameParts = [person.firstName, person.lastName].filter((part) => !!part && part.trim().length)
      const displayName = nameParts.length ? nameParts.join(' ') : person.email
      const personEntity = em.create(CustomerEntity, {
        organizationId,
        tenantId,
        kind: 'person',
        displayName,
        description: person.description ?? null,
        primaryEmail: person.email,
        primaryPhone: person.phone ?? null,
      lifecycleStage: company.lifecycleStage ?? null,
      status: 'active',
      source: person.source ?? company.source ?? null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
      const personProfile = em.create(CustomerPersonProfile, {
        organizationId,
        tenantId,
        entity: personEntity,
        company: companyEntity,
        firstName: person.firstName,
        lastName: person.lastName,
        preferredName: person.preferredName ?? null,
        jobTitle: person.jobTitle ?? null,
        department: person.department ?? null,
        seniority: person.seniority ?? null,
        timezone: person.timezone ?? null,
        linkedInUrl: person.linkedInUrl ?? null,
        twitterUrl: person.twitterUrl ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      em.persist(personEntity)
      em.persist(personProfile)

      if (person.custom && Object.keys(person.custom).length) {
        const values = { ...person.custom } as CustomFieldValuesPayload
        customFieldAssignments.push(async () =>
          dataEngine.setCustomFields({
            entityId: CoreEntities.customers.customer_person_profile,
            recordId: personProfile.id,
            organizationId,
            tenantId,
            values,
          })
        )
      }

      if (person.address?.addressLine1) {
        const address = em.create(CustomerAddress, {
          organizationId,
          tenantId,
          entity: personEntity,
          name: person.address.name ?? null,
          purpose: person.address.purpose ?? 'work',
          addressLine1: person.address.addressLine1,
          addressLine2: person.address.addressLine2 ?? null,
          city: person.address.city ?? null,
          region: person.address.region ?? null,
          postalCode: person.address.postalCode ?? null,
          country: person.address.country ?? null,
          latitude: person.address.latitude ?? null,
          longitude: person.address.longitude ?? null,
          buildingNumber: person.address.buildingNumber ?? null,
          flatNumber: person.address.flatNumber ?? null,
          isPrimary: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        em.persist(address)
      }

      personEntities.set(person.slug, personEntity)
    }

    for (const interaction of company.interactions ?? []) {
      const targetEntity =
        interaction.entity === 'person' && interaction.personSlug
          ? personEntities.get(interaction.personSlug)
          : companyEntity
      if (!targetEntity) continue
      const activity = em.create(CustomerActivity, {
        organizationId,
        tenantId,
        entity: targetEntity,
        deal: null,
        activityType: interaction.type,
        subject: interaction.subject ?? null,
        body: interaction.body ?? null,
        occurredAt: interaction.occurredAt ? new Date(interaction.occurredAt) : null,
        appearanceIcon: interaction.icon ?? null,
        appearanceColor: interaction.color ?? null,
        authorUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      em.persist(activity)

      if (interaction.custom && Object.keys(interaction.custom).length) {
        const values = { ...interaction.custom } as CustomFieldValuesPayload
        customFieldAssignments.push(async () =>
          dataEngine.setCustomFields({
            entityId: CoreEntities.customers.customer_activity,
            recordId: activity.id,
            organizationId,
            tenantId,
            values,
          })
        )
      }
    }

    for (const note of company.notes ?? []) {
      const targetEntity =
        note.entity === 'person' && note.personSlug ? personEntities.get(note.personSlug) : companyEntity
      if (!targetEntity) continue
      const comment = em.create(CustomerComment, {
        organizationId,
        tenantId,
        entity: targetEntity,
        deal: null,
        body: note.body,
        authorUserId: null,
        appearanceIcon: note.icon ?? null,
        appearanceColor: note.color ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      if (note.occurredAt) {
        const timestamp = new Date(note.occurredAt)
        if (!Number.isNaN(timestamp.getTime())) {
          comment.createdAt = timestamp
          comment.updatedAt = timestamp
        }
      }
      em.persist(comment)
    }
  }

  // Load default pipeline and build a value→stageId lookup so deals appear in the pipeline view
  const defaultPipeline = await em.findOne(CustomerPipeline, { tenantId, organizationId, isDefault: true })
  const pipelineStages = defaultPipeline
    ? await em.find(CustomerPipelineStage, { pipelineId: defaultPipeline.id }, { orderBy: { order: 'ASC' } })
    : []
  const stageValueToId = new Map<string, string>()
  for (let i = 0; i < pipelineStages.length && i < PIPELINE_STAGE_DEFAULTS.length; i++) {
    stageValueToId.set(PIPELINE_STAGE_DEFAULTS[i].value, pipelineStages[i].id)
  }

  for (const company of CUSTOMER_EXAMPLES) {
    const companyEntity = companyEntities.get(company.slug)
    if (!companyEntity) continue
    for (const dealInfo of company.deals ?? []) {
      const resolvedStageId = dealInfo.pipelineStage ? stageValueToId.get(dealInfo.pipelineStage) ?? null : null
      const deal = em.create(CustomerDeal, {
        organizationId,
        tenantId,
        title: dealInfo.title,
        description: dealInfo.description ?? null,
        status: dealInfo.status,
        pipelineStage: dealInfo.pipelineStage ?? null,
        pipelineId: resolvedStageId ? defaultPipeline!.id : null,
        pipelineStageId: resolvedStageId,
        valueAmount: toAmount(dealInfo.valueAmount),
        valueCurrency:
          dealInfo.valueCurrency ?? (typeof dealInfo.valueAmount === 'number' ? 'USD' : null),
        probability:
          typeof dealInfo.probability === 'number' ? Math.round(dealInfo.probability) : null,
        expectedCloseAt: dealInfo.expectedCloseAt ? new Date(dealInfo.expectedCloseAt) : null,
        ownerUserId: null,
        source: dealInfo.source ?? company.source ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      em.persist(deal)

      if (dealInfo.custom && Object.keys(dealInfo.custom).length) {
        const values = { ...dealInfo.custom } as CustomFieldValuesPayload
        customFieldAssignments.push(async () =>
          dataEngine.setCustomFields({
            entityId: CoreEntities.customers.customer_deal,
            recordId: deal.id,
            organizationId,
            tenantId,
            values,
          })
        )
      }

      const companyLink = em.create(CustomerDealCompanyLink, {
        deal,
        company: companyEntity,
        createdAt: new Date(),
      })
      em.persist(companyLink)

      for (const participant of dealInfo.people ?? []) {
        const personEntity = personEntities.get(participant.slug)
        if (!personEntity) continue
        const link = em.create(CustomerDealPersonLink, {
          deal,
          person: personEntity,
          participantRole: participant.participantRole ?? null,
          createdAt: new Date(),
        })
        em.persist(link)
      }

      for (const activityInfo of dealInfo.activities ?? []) {
        const targetEntity =
          activityInfo.entity === 'person' && activityInfo.personSlug
            ? personEntities.get(activityInfo.personSlug)
            : companyEntity
        if (!targetEntity) continue
        const activity = em.create(CustomerActivity, {
          organizationId,
          tenantId,
          entity: targetEntity,
          deal,
          activityType: activityInfo.type,
          subject: activityInfo.subject ?? null,
          body: activityInfo.body ?? null,
          occurredAt: activityInfo.occurredAt ? new Date(activityInfo.occurredAt) : null,
          appearanceIcon: activityInfo.icon ?? null,
          appearanceColor: activityInfo.color ?? null,
          authorUserId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        em.persist(activity)

        if (activityInfo.custom && Object.keys(activityInfo.custom).length) {
          const values = { ...activityInfo.custom } as CustomFieldValuesPayload
          customFieldAssignments.push(async () =>
            dataEngine.setCustomFields({
              entityId: CoreEntities.customers.customer_activity,
              recordId: activity.id,
              organizationId,
              tenantId,
              values,
            })
          )
        }
      }
    }
  }

  await em.flush()

  for (const assign of customFieldAssignments) {
    try {
      await assign()
    } catch (err) {
      console.warn('[customers.cli] Failed to set custom fields for seeded record', err)
    }
  }

  return true
}

async function seedCustomerStressTest(
  em: EntityManager,
  container: AppContainer,
  { tenantId, organizationId }: SeedArgs,
  options: StressTestOptions
): Promise<{ created: number; existing: number }> {
  const requested = Math.max(0, Math.floor(options.count ?? 0))
  if (requested <= 0) return { created: 0, existing: 0 }

  const includeExtras = options.includeExtras !== false

  const existingPersons = await em.count(CustomerEntity, {
    tenantId,
    organizationId,
    kind: 'person',
    source: STRESS_TEST_SOURCE,
  })

  if (existingPersons >= requested) {
    options.onProgress?.({ completed: 0, total: 0 })
    return { created: 0, existing: existingPersons }
  }

  const toCreate = requested - existingPersons
  const statusOptions = ENTITY_STATUS_DEFAULTS.map((entry) => entry.value)
  const lifecycleOptions = ENTITY_LIFECYCLE_STAGE_DEFAULTS.map((entry) => entry.value)
  const companyCount = Math.max(1, Math.min(toCreate, Math.round(toCreate / 3)))

  const total = toCreate
  options.onProgress?.({ completed: 0, total })
  const startedAt = Date.now()

  await seedCustomerDictionaries(em, { tenantId, organizationId })

  let cache: CacheStrategy | null = null
  if (includeExtras) {
    if (typeof (container as any).hasRegistration === 'function' && container.hasRegistration('cache')) {
      try {
        cache = (container.resolve('cache') as CacheStrategy)
      } catch {
        cache = null
      }
    }
    try {
      await installCustomEntitiesFromModules(em, cache, {
        tenantIds: [tenantId],
        includeGlobal: false,
        dryRun: false,
        logger: () => {},
      })
    } catch (err) {
      console.warn('[customers.cli] Failed to install custom entities before stress-test seeding', err)
    }
    try {
      await ensureCustomerCustomFieldDefinitions(em, tenantId)
    } catch (err) {
      console.warn('[customers.cli] Failed to ensure custom field definitions for stress-test seeding', err)
    }
  }

  type Primitive = string | number | boolean | null | undefined

  type PendingCustomFieldAssignment = {
    entityId: string
    organizationId: string | null
    tenantId: string | null
    values: Record<string, Primitive | Primitive[] | undefined>
    getRecordId: () => string | undefined
    registeredForIndex?: boolean
  }

  type CustomFieldInsertRow = {
    entityId: string
    recordId: string
    organizationId: string | null
    tenantId: string | null
    fieldKey: string
    valueText?: string | null
    valueMultiline?: string | null
    valueInt?: number | null
    valueFloat?: number | null
    valueBool?: boolean | null
  }

  const pendingAssignments: PendingCustomFieldAssignment[] = []
  const cfRowBuffer: CustomFieldInsertRow[] = []
  const assignmentFlushThreshold = includeExtras ? 100 : 0
  const cfInsertBatchSize = 500
  const flushInterval = 100
  const db = em.getKysely<any>() as any
  const entityIndexesColumnRows = await db
    .selectFrom('information_schema.columns')
    .select(['column_name'])
    .where(sql<boolean>`table_schema = current_schema()`)
    .where('table_name', '=', 'entity_indexes')
    .execute()
    .catch(() => [] as Array<{ column_name: string }>)
  const entityIndexesColumnSet = new Set<string>(
    entityIndexesColumnRows.map((row: any) => String(row.column_name).toLowerCase()),
  )
  const hasColumn = (name: string) => entityIndexesColumnSet.has(name.toLowerCase())
  const supportsOrgCoalesced = hasColumn('organization_id_coalesced')

  type PendingIndexDoc = {
    entityType: string
    recordId: string
    organizationId: string | null
    tenantId: string | null
    baseRow: Record<string, any>
    customFields: IndexCustomFieldValue[]
    createdAt: Date
    updatedAt: Date
  }

  const pendingIndexDocs = new Map<string, Map<string, PendingIndexDoc>>()

  const ensureIndexDoc = (
    entityType: string,
    recordId: string,
    initializer: () => PendingIndexDoc,
  ): PendingIndexDoc => {
    let bucket = pendingIndexDocs.get(entityType)
    if (!bucket) {
      bucket = new Map<string, PendingIndexDoc>()
      pendingIndexDocs.set(entityType, bucket)
    }
    let doc = bucket.get(recordId)
    if (!doc) {
      doc = initializer()
      bucket.set(recordId, doc)
    }
    return doc
  }

  const registerIndexBaseRow = (entityType: string, row: Record<string, any>) => {
    const recordId = String((row as any).id)
    const createdAt = ((row as any).created_at as Date) ?? new Date()
    const updatedAt = ((row as any).updated_at as Date) ?? createdAt
    const organizationId = ((row as any).organization_id ?? null) as string | null
    const tenantId = ((row as any).tenant_id ?? null) as string | null
    const doc = ensureIndexDoc(entityType, recordId, () => ({
      entityType,
      recordId,
      organizationId,
      tenantId,
      baseRow: { ...row },
      customFields: [],
      createdAt,
      updatedAt,
    }))
    doc.entityType = entityType
    doc.recordId = recordId
    doc.organizationId = organizationId
    doc.tenantId = tenantId
    doc.baseRow = { ...row }
    doc.createdAt = createdAt
    doc.updatedAt = updatedAt
  }

  const appendIndexCustomFields = (
    entityType: string,
    recordId: string,
    scope: { organizationId: string | null; tenantId: string | null },
    values: Record<string, Primitive | Primitive[] | undefined>,
  ) => {
    const doc = ensureIndexDoc(entityType, recordId, () => ({
      entityType,
      recordId,
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      baseRow: {},
      customFields: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    doc.organizationId = scope.organizationId
    doc.tenantId = scope.tenantId
    for (const [key, raw] of Object.entries(values)) {
      if (raw === undefined) continue
      const pushValue = (value: Primitive) => {
        doc.customFields.push({
          key,
          value: value ?? null,
          organizationId: scope.organizationId,
          tenantId: scope.tenantId,
        })
      }
      if (Array.isArray(raw)) {
        for (const entry of raw as Primitive[]) pushValue(entry)
      } else {
        pushValue(raw as Primitive)
      }
    }
  }

  const flushIndexDocs = async (trx: any) => {
    const rows: Array<{
      entity_type: string
      entity_id: string
      organization_id: string | null
      tenant_id: string | null
      doc: Record<string, unknown>
      index_version: number
      created_at: Date
      updated_at: Date
      deleted_at: null
    }> = []
    for (const [entityType, bucket] of pendingIndexDocs.entries()) {
      for (const entry of bucket.values()) {
        if (!entry.baseRow || Object.keys(entry.baseRow).length === 0) continue
        rows.push({
          entity_type: entityType,
          entity_id: entry.recordId,
          organization_id: entry.organizationId,
          tenant_id: entry.tenantId,
          doc: buildIndexDocument(entry.baseRow, entry.customFields, {
            organizationId: entry.organizationId,
            tenantId: entry.tenantId,
          }),
          index_version: 1,
          created_at: entry.createdAt,
          updated_at: entry.updatedAt,
          deleted_at: null,
        })
      }
      bucket.clear()
    }
    if (!rows.length) {
      pendingIndexDocs.clear()
      return
    }
    if (supportsOrgCoalesced) {
      await trx
        .insertInto('entity_indexes')
        .values(rows.map((row) => ({ ...row, doc: sql`${JSON.stringify(row.doc)}::jsonb` })))
        .onConflict((oc: any) => oc
          .columns(['entity_type', 'entity_id', 'organization_id_coalesced'])
          .doUpdateSet({
            doc: sql`excluded.doc`,
            index_version: sql`excluded.index_version`,
            organization_id: sql`excluded.organization_id`,
            tenant_id: sql`excluded.tenant_id`,
            deleted_at: sql`excluded.deleted_at`,
            updated_at: sql`excluded.updated_at`,
          }))
        .execute()
    } else {
      for (const row of rows) {
        const updated = await trx
          .updateTable('entity_indexes')
          .set({
            doc: sql`${JSON.stringify(row.doc)}::jsonb`,
            index_version: row.index_version,
            organization_id: row.organization_id,
            tenant_id: row.tenant_id,
            updated_at: row.updated_at,
            deleted_at: null,
          } as any)
          .where('entity_type', '=', row.entity_type)
          .where('entity_id', '=', row.entity_id)
          .where('organization_id', row.organization_id === null ? 'is' : '=', row.organization_id as any)
          .executeTakeFirst() as { numUpdatedRows?: bigint | number } | undefined
        if (updated && Number(updated.numUpdatedRows ?? 0) > 0) continue
        try {
          await trx.insertInto('entity_indexes').values({
            ...row,
            doc: sql`${JSON.stringify(row.doc)}::jsonb`,
          } as any).execute()
        } catch {
          // ignored: row inserted concurrently
        }
      }
    }
    pendingIndexDocs.clear()
  }

  const queueCustomFieldAssignment = (assignment: PendingCustomFieldAssignment) => {
    if (!includeExtras) return
    const recordId = assignment.getRecordId()
    if (recordId) {
      appendIndexCustomFields(
        assignment.entityId,
        recordId,
        { organizationId: assignment.organizationId ?? null, tenantId: assignment.tenantId ?? null },
        assignment.values,
      )
      assignment.registeredForIndex = true
    }
    pendingAssignments.push(assignment)
  }

  const appendRow = (row: CustomFieldInsertRow) => {
    cfRowBuffer.push(row)
  }

  const materializeAssignments = () => {
    if (!pendingAssignments.length) return
    for (const assignment of pendingAssignments.splice(0)) {
      const recordId = assignment.getRecordId()
      if (!recordId) continue
      if (!assignment.registeredForIndex) {
        appendIndexCustomFields(
          assignment.entityId,
          recordId,
          { organizationId: assignment.organizationId ?? null, tenantId: assignment.tenantId ?? null },
          assignment.values,
        )
        assignment.registeredForIndex = true
      }
      for (const [fieldKey, raw] of Object.entries(assignment.values)) {
        if (raw === undefined) continue
        if (Array.isArray(raw)) {
          for (const val of raw as Primitive[]) {
            appendRow(buildCustomFieldRow(assignment, recordId, fieldKey, val))
          }
        } else {
          appendRow(buildCustomFieldRow(assignment, recordId, fieldKey, raw))
        }
      }
    }
  }

  const buildCustomFieldRow = (
    assignment: PendingCustomFieldAssignment,
    recordId: string,
    fieldKey: string,
    value: Primitive
  ): CustomFieldInsertRow => {
    const base: CustomFieldInsertRow = {
      entityId: assignment.entityId,
      recordId,
      organizationId: assignment.organizationId ?? null,
      tenantId: assignment.tenantId ?? null,
      fieldKey,
    }
    if (value === null || value === undefined) {
      base.valueText = null
      return base
    }
    if (typeof value === 'boolean') {
      base.valueBool = value
      return base
    }
    if (typeof value === 'number') {
      if (Number.isInteger(value)) base.valueInt = value
      else base.valueFloat = value
      return base
    }
    base.valueText = String(value)
    return base
  }

  const flushCustomFieldRows = async (force: boolean) => {
    if (!includeExtras) return
    if (!force && cfRowBuffer.length < cfInsertBatchSize) return
    if (!cfRowBuffer.length) return
    const chunkSize = cfInsertBatchSize
    while (cfRowBuffer.length) {
      const chunk = cfRowBuffer.splice(0, chunkSize)
      const timestamp = new Date()
      const payload = chunk.map((row) => ({
        entity_id: row.entityId,
        record_id: row.recordId,
        organization_id: row.organizationId,
        tenant_id: row.tenantId,
        field_key: row.fieldKey,
        value_text: row.valueText ?? null,
        value_multiline: row.valueMultiline ?? null,
        value_int: row.valueInt ?? null,
        value_float: row.valueFloat ?? null,
        value_bool: row.valueBool ?? null,
        created_at: timestamp,
        deleted_at: null,
      }))
      await db.insertInto('custom_field_values').values(payload).execute()
    }
  }

  const flushAssignments = async (force = false) => {
    if (!includeExtras) {
      if (force) await em.flush()
      return
    }
    if (!force && pendingAssignments.length < assignmentFlushThreshold && cfRowBuffer.length < cfInsertBatchSize) return
    await em.flush()
    materializeAssignments()
    await flushCustomFieldRows(force)
  }

  // bulk insert data structures and generation implemented below

  type CustomerEntityRow = {
    id: string
    organization_id: string
    tenant_id: string
    kind: 'company' | 'person'
    display_name: string
    description: string | null
    owner_user_id: string | null
    primary_email: string | null
    primary_phone: string | null
    status: string | null
    lifecycle_stage: string | null
    source: string | null
    next_interaction_at: Date | null
    next_interaction_name: string | null
    next_interaction_ref_id: string | null
    next_interaction_icon: string | null
    next_interaction_color: string | null
    is_active: boolean
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
  }

  type CustomerCompanyProfileRow = {
    id: string
    organization_id: string
    tenant_id: string
    entity_id: string
    legal_name: string | null
    brand_name: string | null
    domain: string | null
    website_url: string | null
    industry: string | null
    size_bucket: string | null
    annual_revenue: string | null
    created_at: Date
    updated_at: Date
  }

  type CustomerPersonProfileRow = {
    id: string
    organization_id: string
    tenant_id: string
    entity_id: string
    company_entity_id: string | null
    first_name: string | null
    last_name: string | null
    preferred_name: string | null
    job_title: string | null
    department: string | null
    seniority: string | null
    timezone: string | null
    linked_in_url: string | null
    twitter_url: string | null
    created_at: Date
    updated_at: Date
  }

  type CustomerDealRow = {
    id: string
    organization_id: string
    tenant_id: string
    title: string
    description: string | null
    status: string
    pipeline_stage: string | null
    value_amount: string | null
    value_currency: string | null
    probability: number | null
    expected_close_at: Date | null
    owner_user_id: string | null
    source: string | null
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
  }

  type CustomerDealCompanyRow = {
    id: string
    deal_id: string
    company_entity_id: string
    created_at: Date
  }

  type CustomerDealPersonRow = {
    id: string
    deal_id: string
    person_entity_id: string
    role: string | null
    created_at: Date
  }

  type CustomerActivityRow = {
    id: string
    organization_id: string
    tenant_id: string
    entity_id: string
    deal_id: string | null
    activity_type: string
    subject: string | null
    body: string | null
    occurred_at: Date | null
    author_user_id: string | null
    appearance_icon: string | null
    appearance_color: string | null
    created_at: Date
    updated_at: Date
  }

  type CustomerCommentRow = {
    id: string
    organization_id: string
    tenant_id: string
    entity_id: string
    deal_id: string | null
    body: string
    author_user_id: string | null
    appearance_icon: string | null
    appearance_color: string | null
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
  }

  type CompanyRecord = {
    entityId: string
    companyProfileId: string
    status: string | null
    lifecycleStage: string | null
    source: string | null
    displayName: string
  }

  const customerEntityRows: CustomerEntityRow[] = []
  const companyProfileRows: CustomerCompanyProfileRow[] = []
  const personProfileRows: CustomerPersonProfileRow[] = []
  const dealRows: CustomerDealRow[] = []
  const dealCompanyRows: CustomerDealCompanyRow[] = []
  const dealPersonRows: CustomerDealPersonRow[] = []
  const activityRows: CustomerActivityRow[] = []
  const commentRows: CustomerCommentRow[] = []
  const companies: CompanyRecord[] = []
  const entityInsertBatchSize = 1000
  const contactsPerCompany = Math.max(1, Math.ceil(toCreate / companyCount))

  await warnIfStressTestSchemaChanged(db)

  const insertRows = async (trx: any, table: string, rows: unknown[]) => {
    if (!rows.length) return
    for (let i = 0; i < rows.length; i += entityInsertBatchSize) {
      const chunk = rows.slice(i, i + entityInsertBatchSize)
      await trx.insertInto(table).values(chunk as any).execute()
    }
    rows.length = 0
  }

  const flushEntityRows = async (force = false) => {
    if (!force) return
    const pendingCount =
      customerEntityRows.length +
      companyProfileRows.length +
      personProfileRows.length +
      dealRows.length +
      dealCompanyRows.length +
      dealPersonRows.length +
      activityRows.length +
      commentRows.length
    if (pendingCount === 0) return
    await db.transaction().execute(async (trx: any) => {
      await insertRows(trx, 'customer_entities', customerEntityRows)
      await insertRows(trx, 'customer_companies', companyProfileRows)
      await insertRows(trx, 'customer_people', personProfileRows)
      if (includeExtras) {
        await insertRows(trx, 'customer_deals', dealRows)
        await insertRows(trx, 'customer_deal_companies', dealCompanyRows)
        await insertRows(trx, 'customer_deal_people', dealPersonRows)
        await insertRows(trx, 'customer_activities', activityRows)
        await insertRows(trx, 'customer_comments', commentRows)
      }
      await flushIndexDocs(trx)
    })
  }

  const createCompanyRecord = (): CompanyRecord => {
    const companyId = randomUUID()
    const profileId = randomUUID()
    const status = randomChoice(statusOptions)
    const lifecycleStage = randomChoice(lifecycleOptions)
    const prefix = randomChoice(STRESS_TEST_COMPANY_PREFIX)
    const suffix = randomChoice(STRESS_TEST_COMPANY_SUFFIX)
    const baseName = `${prefix} ${suffix}`
    const sequence = existingPersons + companies.length + 1
    const displayName = `${baseName} ${sequence}`
    const domainBase = slugifyValue(`${prefix}-${suffix}-${sequence}`) || `company-${sequence}`
    const domain = `${domainBase}.${STRESS_TEST_EMAIL_DOMAIN}`
    const websiteUrl = `https://www.${domain}`
    const primaryEmail = `hello@${domain}`
    const primaryPhone = buildPhone(sequence)
    const timestamp = new Date()
    const entityRow: CustomerEntityRow = {
      id: companyId,
      organization_id: organizationId,
      tenant_id: tenantId,
      kind: 'company',
      display_name: displayName,
      description: `Stress test company #${sequence}`,
      owner_user_id: null,
      primary_email: primaryEmail,
      primary_phone: primaryPhone,
      status,
      lifecycle_stage: lifecycleStage,
      source: STRESS_TEST_SOURCE,
      next_interaction_at: null,
      next_interaction_name: null,
      next_interaction_ref_id: null,
      next_interaction_icon: null,
      next_interaction_color: null,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    }
    customerEntityRows.push(entityRow)
    registerIndexBaseRow(CoreEntities.customers.customer_entity, entityRow)
    const profileRow: CustomerCompanyProfileRow = {
      id: profileId,
      organization_id: organizationId,
      tenant_id: tenantId,
      entity_id: companyId,
      legal_name: `${displayName} LLC`,
      brand_name: baseName,
      domain,
      website_url: websiteUrl,
      industry: randomChoice(STRESS_TEST_INDUSTRIES),
      size_bucket: randomChoice(STRESS_TEST_SIZE_BUCKETS),
      annual_revenue: null,
      created_at: timestamp,
      updated_at: timestamp,
    }
    companyProfileRows.push(profileRow)
    registerIndexBaseRow(CoreEntities.customers.customer_company_profile, profileRow)
    const record: CompanyRecord = {
      entityId: companyId,
      companyProfileId: profileId,
      status,
      lifecycleStage,
      source: STRESS_TEST_SOURCE,
      displayName,
    }
    if (includeExtras) {
      const companyFieldValues: Record<string, Primitive | Primitive[]> = {
        relationship_health: randomChoice(STRESS_TEST_RELATIONSHIP_HEALTH),
        renewal_quarter: randomChoice(STRESS_TEST_RENEWAL_QUARTERS),
        customer_marketing_case: Math.random() < 0.35,
      }
      if (Math.random() < 0.4) companyFieldValues.executive_notes = randomChoice(STRESS_TEST_NOTE_SNIPPETS)
      queueCustomFieldAssignment({
        entityId: CoreEntities.customers.customer_company_profile,
        organizationId,
        tenantId,
        values: companyFieldValues,
        getRecordId: () => profileId,
      })
    }
    companies.push(record)
    return record
  }

  let created = 0
  for (let i = 0; i < toCreate; i += 1) {
    const desiredCompanyIndex = Math.floor(i / contactsPerCompany)
    while (companies.length <= desiredCompanyIndex && companies.length < companyCount) {
      createCompanyRecord()
    }
    const companyRecord =
      companies[Math.min(desiredCompanyIndex, companies.length - 1)] ?? createCompanyRecord()

    const sequence = existingPersons + i + 1
    const timestamp = new Date()
    const firstName = randomChoice(STRESS_TEST_FIRST_NAMES)
    const lastName = randomChoice(STRESS_TEST_LAST_NAMES)
    const displayName = `${firstName} ${lastName}`
    const emailHandle = slugifyValue(`${firstName}.${lastName}`) || `contact-${sequence}`
    const email = `${emailHandle}.${sequence}@${STRESS_TEST_EMAIL_DOMAIN}`
    const timezone = randomChoice(STRESS_TEST_TIMEZONES)
    const personEntityId = randomUUID()
    const personEntityRow: CustomerEntityRow = {
      id: personEntityId,
      organization_id: organizationId,
      tenant_id: tenantId,
      kind: 'person',
      display_name: displayName,
      description: `Stress test contact #${sequence}`,
      owner_user_id: null,
      primary_email: email,
      primary_phone: buildPhone(sequence),
      status: companyRecord.status,
      lifecycle_stage: companyRecord.lifecycleStage,
      source: companyRecord.source,
      next_interaction_at: null,
      next_interaction_name: null,
      next_interaction_ref_id: null,
      next_interaction_icon: null,
      next_interaction_color: null,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    }
    customerEntityRows.push(personEntityRow)
    registerIndexBaseRow(CoreEntities.customers.customer_entity, personEntityRow)
    const personProfileId = randomUUID()
    const personProfileRow: CustomerPersonProfileRow = {
      id: personProfileId,
      organization_id: organizationId,
      tenant_id: tenantId,
      entity_id: personEntityId,
      company_entity_id: companyRecord.entityId,
      first_name: firstName,
      last_name: lastName,
      preferred_name: firstName,
      job_title: randomChoice(STRESS_TEST_JOB_TITLES),
      department: randomChoice(STRESS_TEST_DEPARTMENTS),
      seniority: randomChoice(STRESS_TEST_SENIORITY),
      timezone,
      linked_in_url: `https://www.linkedin.com/in/${emailHandle}${sequence}`,
      twitter_url: `https://twitter.com/${emailHandle}${sequence}`,
      created_at: timestamp,
      updated_at: timestamp,
    }
    personProfileRows.push(personProfileRow)
    registerIndexBaseRow(CoreEntities.customers.customer_person_profile, personProfileRow)

    if (includeExtras) {
      const personFieldValues: Record<string, Primitive | Primitive[]> = {
        buying_role: randomChoice(STRESS_TEST_BUYING_ROLES),
        preferred_pronouns: randomChoice(STRESS_TEST_PRONOUNS),
        newsletter_opt_in: Math.random() < 0.5,
      }
      queueCustomFieldAssignment({
        entityId: CoreEntities.customers.customer_person_profile,
        organizationId,
        tenantId,
        values: personFieldValues,
        getRecordId: () => personProfileId,
      })

      const monetaryBase = randomInt(5, 220) * 1000
      const pipelineStage = randomChoice(STRESS_TEST_DEAL_PIPELINE)
      const dealStatus = randomChoice(STRESS_TEST_DEAL_STATUSES)
      const dealId = randomUUID()
      const valueAmount = toAmount(monetaryBase + randomInt(0, 7500))
      const expectedCloseAt =
        dealStatus === 'win' || dealStatus === 'closed' || dealStatus === 'loose'
          ? randomPastDate(120)
          : randomFutureDate(120)
      const dealRow: CustomerDealRow = {
        id: dealId,
        organization_id: organizationId,
        tenant_id: tenantId,
        title: `${companyRecord.displayName} Opportunity ${sequence}`,
        description: `Stress test deal generated for contact #${sequence}`,
        status: dealStatus,
        pipeline_stage: pipelineStage ?? null,
        value_amount: valueAmount,
        value_currency: Math.random() < 0.6 ? 'USD' : 'EUR',
        probability: randomInt(25, 95),
        expected_close_at: expectedCloseAt,
        owner_user_id: null,
        source: companyRecord.source,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
      }
      dealRows.push(dealRow)
      registerIndexBaseRow(CoreEntities.customers.customer_deal, dealRow)
      dealCompanyRows.push({
        id: randomUUID(),
        deal_id: dealId,
        company_entity_id: companyRecord.entityId,
        created_at: timestamp,
      })
      dealPersonRows.push({
        id: randomUUID(),
        deal_id: dealId,
        person_entity_id: personEntityId,
        role: randomChoice(STRESS_TEST_DEAL_CUSTOMER_ROLES),
        created_at: timestamp,
      })

      queueCustomFieldAssignment({
        entityId: CoreEntities.customers.customer_deal,
        organizationId,
        tenantId,
        values: {
          competitive_risk: randomChoice(STRESS_TEST_DEAL_RISK),
          implementation_complexity: randomChoice(STRESS_TEST_IMPLEMENTATION),
          estimated_seats: randomInt(5, 250),
          requires_legal_review: Math.random() < 0.3,
        },
        getRecordId: () => dealId,
      })

      const activityCount = randomInt(2, 5)
      for (let idx = 0; idx < activityCount; idx += 1) {
        const activityType = randomChoice(STRESS_TEST_DEAL_ACTIVITY_TYPES)
        const activityId = randomUUID()
        const targetEntityId = activityType === 'person' ? personEntityId : companyRecord.entityId
        const occurredAt = randomPastDate(200)
        const activityRow: CustomerActivityRow = {
          id: activityId,
          organization_id: organizationId,
          tenant_id: tenantId,
          entity_id: targetEntityId,
          deal_id: dealId,
          activity_type: activityType,
          subject: randomChoice(STRESS_TEST_ACTIVITY_SUBJECTS),
          body: randomChoice(STRESS_TEST_ACTIVITY_BODIES),
          occurred_at: occurredAt,
          author_user_id: null,
          appearance_icon: randomChoice(STRESS_TEST_ACTIVITY_ICONS),
          appearance_color: randomChoice(['#2563eb', '#22c55e', '#f97316', '#a855f7', '#6366f1']),
          created_at: timestamp,
          updated_at: timestamp,
        }
        activityRows.push(activityRow)
        registerIndexBaseRow(CoreEntities.customers.customer_activity, activityRow)

        queueCustomFieldAssignment({
          entityId: CoreEntities.customers.customer_activity,
          organizationId,
          tenantId,
          values: {
            engagement_sentiment: randomChoice(STRESS_TEST_ACTIVITY_SENTIMENT),
            shared_with_leadership: Math.random() < 0.4,
            follow_up_owner: randomChoice(STRESS_TEST_ACTIVITY_OWNERS),
          },
          getRecordId: () => activityId,
        })
      }

      const noteCount = randomInt(2, 5)
      for (let idx = 0; idx < noteCount; idx += 1) {
        const noteTimestamp = randomPastDate(120)
        commentRows.push({
          id: randomUUID(),
          organization_id: organizationId,
          tenant_id: tenantId,
          entity_id: personEntityId,
          deal_id: dealId,
          body: randomChoice(STRESS_TEST_NOTE_SNIPPETS),
          author_user_id: null,
          appearance_icon: 'lucide:sticky-note',
          appearance_color: randomChoice(['#2563eb', '#22c55e', '#f97316', '#a855f7', '#6366f1']),
          created_at: noteTimestamp,
          updated_at: noteTimestamp,
          deleted_at: null,
        })
      }
    }

    created += 1
    const shouldFlush = created % flushInterval === 0
    if (shouldFlush) await flushEntityRows(true)
    options.onProgress?.({ completed: created, total })
    if (shouldFlush) await flushAssignments(true)
    else await flushAssignments()
  }

  await flushEntityRows(true)
  await flushAssignments(true)
  options.onProgress?.({ completed: total, total })
  const elapsedMs = Math.max(1, Date.now() - startedAt)
  const recordsPerSecond = toCreate > 0 ? (toCreate / elapsedMs) * 1000 : 0
  console.log(
    `⚡ Stress test seeding throughput: ${toCreate.toLocaleString()} records in ${(elapsedMs / 1000).toFixed(
      1
    )}s (${recordsPerSecond.toFixed(1)} records/s${includeExtras ? '' : ' - lite mode'})`
  )

  return { created: toCreate, existing: existingPersons }
}


const STRESS_TEST_REQUIRED_COLUMNS: Record<string, readonly string[]> = {
  customer_entities: [
    'id',
    'organization_id',
    'tenant_id',
    'kind',
    'display_name',
    'description',
    'owner_user_id',
    'primary_email',
    'primary_phone',
    'status',
    'lifecycle_stage',
    'source',
    'next_interaction_at',
    'next_interaction_name',
    'next_interaction_ref_id',
    'next_interaction_icon',
    'next_interaction_color',
    'is_active',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  customer_companies: [
    'id',
    'organization_id',
    'tenant_id',
    'entity_id',
    'legal_name',
    'brand_name',
    'domain',
    'website_url',
    'industry',
    'size_bucket',
    'annual_revenue',
    'created_at',
    'updated_at',
  ],
  customer_people: [
    'id',
    'organization_id',
    'tenant_id',
    'first_name',
    'last_name',
    'preferred_name',
    'job_title',
    'department',
    'seniority',
    'timezone',
    'linked_in_url',
    'twitter_url',
    'created_at',
    'updated_at',
    'entity_id',
    'company_entity_id',
  ],
  customer_deals: [
    'id',
    'organization_id',
    'tenant_id',
    'title',
    'description',
    'status',
    'pipeline_stage',
    'value_amount',
    'value_currency',
    'probability',
    'expected_close_at',
    'owner_user_id',
    'source',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  customer_deal_companies: ['id', 'deal_id', 'company_entity_id', 'created_at'],
  customer_deal_people: ['id', 'deal_id', 'person_entity_id', 'role', 'created_at'],
  customer_activities: [
    'id',
    'organization_id',
    'tenant_id',
    'entity_id',
    'deal_id',
    'activity_type',
    'subject',
    'body',
    'occurred_at',
    'author_user_id',
    'appearance_icon',
    'appearance_color',
    'created_at',
    'updated_at',
  ],
  customer_comments: [
    'id',
    'organization_id',
    'tenant_id',
    'entity_id',
    'deal_id',
    'body',
    'author_user_id',
    'appearance_icon',
    'appearance_color',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  custom_field_values: [
    'entity_id',
    'record_id',
    'organization_id',
    'tenant_id',
    'field_key',
    'value_text',
    'value_multiline',
    'value_int',
    'value_float',
    'value_bool',
    'created_at',
    'deleted_at',
  ],
}

async function warnIfStressTestSchemaChanged(db: Kysely<any>) {
  try {
    const warnings: string[] = []
    for (const [table, requiredColumns] of Object.entries(STRESS_TEST_REQUIRED_COLUMNS)) {
      const rows = await (db as any)
        .selectFrom('information_schema.columns')
        .select('column_name')
        .where(sql<boolean>`table_schema = current_schema()`)
        .where('table_name', '=', table)
        .execute() as Array<{ column_name: string }>
      const existing = new Set(rows.map((row) => row.column_name))
      const missing = requiredColumns.filter((column) => !existing.has(column))
      if (missing.length) warnings.push(`${table}: missing ${missing.join(', ')}`)
    }
    if (warnings.length) {
      console.warn('[customers.cli] Warning: stress-test bulk seeder detected schema differences. Bulk insert path may need updates:')
      warnings.forEach((warning) => console.warn(`  - ${warning}`))
    }
  } catch (err) {
    console.warn('[customers.cli] Warning: unable to verify schema for stress-test bulk seeder', err)
  }
}

const seedDictionaries: ModuleCli = {
  command: 'seed-dictionaries',
  async run(rest) {
    const args = parseArgs(rest)
    const tenantId = String(args.tenantId ?? args.tenant ?? '')
    const organizationId = String(args.organizationId ?? args.orgId ?? args.org ?? '')
    if (!tenantId || !organizationId) {
      console.error('Usage: helios customers seed-dictionaries --tenant <tenantId> --org <organizationId>')
      return
    }
    const { resolve } = await createRequestContainer()
    const em = resolve<EntityManager>('em')
    await em.transactional(async (tem) => {
      await seedCustomerDictionaries(tem, { tenantId, organizationId })
      await seedCurrencyDictionary(tem, { tenantId, organizationId })
      await tem.flush()
    })
    console.log('📚 Customer dictionaries seeded for organization', organizationId)
  },
}

const seedExamples: ModuleCli = {
  command: 'seed-examples',
  async run(rest) {
    const args = parseArgs(rest)
    const tenantId = String(args.tenantId ?? args.tenant ?? '')
    const organizationId = String(args.organizationId ?? args.orgId ?? args.org ?? '')
    if (!tenantId || !organizationId) {
      console.error('Usage: helios customers seed-examples --tenant <tenantId> --org <organizationId>')
      return
    }
    const container = await createRequestContainer()
    const em = (container.resolve('em') as EntityManager)
    const seeded = await em.transactional(async (tem) =>
      seedCustomerExamples(tem, container, { tenantId, organizationId })
    )
    if (seeded) {
      console.log('Customer example data seeded for organization', organizationId)
    } else {
      console.log('Customer example data already present; skipping')
    }
  },
}

const seedStressTest: ModuleCli = {
  command: 'seed-stresstest',
  async run(rest) {
    const args = parseArgs(rest)
    const tenantId = String(args.tenantId ?? args.tenant ?? '')
    const organizationId = String(args.organizationId ?? args.orgId ?? args.org ?? '')
    if (!tenantId || !organizationId) {
      console.error('Usage: helios customers seed-stresstest --tenant <tenantId> --org <organizationId> [--count <number>] [--lite]')
      return
    }
    const defaultCount = 6000
    const countRaw =
      args.count ?? args.total ?? args.number ?? args.customers ?? String(defaultCount)
    const parsedCount = Number.parseInt(countRaw, 10)
    const count = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : defaultCount
    const liteFlag = (() => {
      if (typeof args.lite === 'string') {
        if (!args.lite.trim()) return true
        return parseBooleanToken(args.lite) === true
      }
      return false
    })()
    const liteMode =
      liteFlag ||
      args.mode === 'lite' ||
      args.payload === 'lite' ||
      args.variant === 'lite'

    const container = await createRequestContainer()
    const em = (container.resolve('em') as EntityManager)
    let progressBar: ProgressBarHandle | null = null
    const result = await seedCustomerStressTest(
      em,
      container,
      { tenantId, organizationId },
      {
        count,
        includeExtras: !liteMode,
        onProgress: ({ completed, total }) => {
          if (total <= 0) return
          if (!progressBar) {
            const label = liteMode ? 'Generating stress-test customers (lite)' : 'Generating stress-test customers'
            progressBar = createProgressBar(label, total)
          }
          if (progressBar) {
            ;(progressBar as unknown as { update(completed: number): void }).update(completed)
          }
        },
      }
    )
    if (progressBar) {
      ;(progressBar as unknown as { complete(): void }).complete()
    }

    try {
      const eventBus = (container.resolve('eventBus') as any)
      const coverageEntities = [
        CoreEntities.customers.customer_entity,
        CoreEntities.customers.customer_person_profile,
        CoreEntities.customers.customer_company_profile,
      ]
      await Promise.all(
        coverageEntities.map(async (entityType) => {
          await eventBus.emitEvent('query_index.coverage.refresh', {
            entityType,
            tenantId,
            organizationId,
            delayMs: 0,
          })
          await eventBus.emitEvent('query_index.coverage.refresh', {
            entityType,
            tenantId,
            organizationId: null,
            delayMs: 0,
          })
        })
      )
    } catch (err) {
      console.warn('[customers.cli] Failed to refresh query index coverage after stress-test seeding', err)
    }

    if (result.created > 0) {
      console.log(
        `Created ${result.created} stress test customer contacts (existing previously: ${result.existing})`
      )
    } else {
      console.log(
        `Stress test dataset already satisfied (existing contacts: ${result.existing}, requested: ${count})`
      )
    }
  },
}

async function seedDefaultPipeline(em: EntityManager, { tenantId, organizationId }: SeedArgs): Promise<void> {
  const existing = await em.findOne(CustomerPipeline, { tenantId, organizationId, isDefault: true })
  if (existing) return

  const pipeline = em.create(CustomerPipeline, {
    tenantId,
    organizationId,
    name: '默认销售管道',
    isDefault: true,
  })
  em.persist(pipeline)
  await em.flush()

  for (let i = 0; i < PIPELINE_STAGE_DEFAULTS.length; i++) {
    const entry = PIPELINE_STAGE_DEFAULTS[i]
    em.persist(em.create(CustomerPipelineStage, {
      tenantId,
      organizationId,
      pipelineId: pipeline.id,
      label: entry.label,
      order: i,
    }))
  }
  await em.flush()
}

export { seedCustomerDictionaries, seedCustomerExamples, seedCustomerStressTest, seedCurrencyDictionary, seedDefaultPipeline }
export type { SeedArgs as CustomerSeedArgs }

// ---------------------------------------------------------------------------
// interactions:backfill — migrate legacy activities & todo-links to interactions
// ---------------------------------------------------------------------------

const BACKFILL_BATCH_SIZE = 100
const PROJECTION_BATCH_SIZE = 50

const TITLE_FIELDS_BACKFILL = ['title', 'subject', 'name', 'summary', 'text'] as const
const IS_DONE_FIELDS_BACKFILL = ['is_done', 'isDone', 'done', 'completed'] as const

function resolveBackfillTodoTitle(raw: Record<string, unknown>): string {
  for (const key of TITLE_FIELDS_BACKFILL) {
    const value = raw[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return 'Migrated task'
}

function resolveBackfillTodoIsDone(raw: Record<string, unknown>): boolean {
  for (const key of IS_DONE_FIELDS_BACKFILL) {
    const value = raw[key]
    if (typeof value === 'boolean') return value
  }
  return false
}

async function backfillInteractions(
  em: EntityManager,
  container: { resolve: (name: string) => unknown },
  args: SeedArgs,
): Promise<{ activitiesMigrated: number; todosMigrated: number; projectionsRecomputed: number; errors: number }> {
  const db = em.getKysely<any>() as any
  const { tenantId, organizationId } = args

  let activitiesMigrated = 0
  let todosMigrated = 0
  let projectionsRecomputed = 0
  let errors = 0
  const affectedEntityIds = new Set<string>()

  // Step 1: Migrate activities → interactions
  console.log('[backfill] Migrating activities to interactions...')
  while (true) {
    const activities = await db
      .selectFrom('customer_activities')
      .select([
        'customer_activities.id',
        'customer_activities.organization_id',
        'customer_activities.tenant_id',
        'customer_activities.activity_type',
        'customer_activities.subject',
        'customer_activities.body',
        'customer_activities.occurred_at',
        'customer_activities.author_user_id',
        'customer_activities.appearance_icon',
        'customer_activities.appearance_color',
        'customer_activities.entity_id',
        'customer_activities.deal_id',
      ])
      .where('customer_activities.tenant_id', '=', tenantId)
      .where('customer_activities.organization_id', '=', organizationId)
      .where((eb: any) => eb.not(eb.exists(
        eb.selectFrom('customer_interactions')
          .select(sql<number>`1`.as('one'))
          .whereRef('customer_interactions.id', '=', 'customer_activities.id')
      )))
      .orderBy('customer_activities.created_at', 'asc')
      .limit(BACKFILL_BATCH_SIZE)
      .execute() as any[]

    if (activities.length === 0) break

    for (const activity of activities) {
      try {
        const status = activity.occurred_at ? 'done' : 'planned'
        await db.insertInto('customer_interactions').values({
          id: activity.id,
          organization_id: activity.organization_id,
          tenant_id: activity.tenant_id,
          interaction_type: activity.activity_type,
          title: activity.subject,
          body: activity.body,
          status,
          scheduled_at: null,
          occurred_at: activity.occurred_at,
          author_user_id: activity.author_user_id,
          appearance_icon: activity.appearance_icon,
          appearance_color: activity.appearance_color,
          source: CUSTOMER_INTERACTION_ACTIVITY_ADAPTER_SOURCE,
          entity_id: activity.entity_id,
          deal_id: activity.deal_id,
          created_at: new Date(),
          updated_at: new Date(),
        } as any).execute()
        activitiesMigrated++
        affectedEntityIds.add(activity.entity_id)
      } catch (err) {
        errors++
        console.warn(`[backfill] Error migrating activity ${activity.id}:`, err instanceof Error ? err.message : err)
      }
    }

    console.log(`[backfill]   Activities batch: ${activities.length} processed (total migrated: ${activitiesMigrated})`)

    if (activities.length < BACKFILL_BATCH_SIZE) break
  }

  // Step 2: Migrate todo links → interactions
  console.log('[backfill] Migrating todo links to interactions...')

  let queryEngine: QueryEngine | null = null
  try {
    queryEngine = container.resolve('queryEngine') as QueryEngine
  } catch {
    console.warn('[backfill] QueryEngine not available; todo titles will use fallback')
  }

  while (true) {
    const todoLinks = await db
      .selectFrom('customer_todo_links')
      .select([
        'customer_todo_links.id',
        'customer_todo_links.organization_id',
        'customer_todo_links.tenant_id',
        'customer_todo_links.todo_id',
        'customer_todo_links.todo_source',
        'customer_todo_links.entity_id',
        'customer_todo_links.created_at',
      ])
      .where('customer_todo_links.tenant_id', '=', tenantId)
      .where('customer_todo_links.organization_id', '=', organizationId)
      .where((eb: any) => eb.not(eb.exists(
        eb.selectFrom('customer_interactions')
          .select(sql<number>`1`.as('one'))
          .whereRef('customer_interactions.id', '=', 'customer_todo_links.todo_id')
      )))
      .orderBy('customer_todo_links.created_at', 'asc')
      .limit(BACKFILL_BATCH_SIZE)
      .execute() as any[]

    if (todoLinks.length === 0) break

    // Batch-resolve todo summaries via QueryEngine if available
    const todoSummaries = new Map<string, { title: string; isDone: boolean }>()
    if (queryEngine) {
      const idsBySource = new Map<string, Set<string>>()
      for (const link of todoLinks) {
        if (!link.todo_source || !link.todo_id) continue
        if (!idsBySource.has(link.todo_source)) idsBySource.set(link.todo_source, new Set())
        idsBySource.get(link.todo_source)!.add(link.todo_id)
      }

      for (const [source, idSet] of idsBySource.entries()) {
        const ids = Array.from(idSet)
        try {
          const result = await queryEngine.query<Record<string, unknown>>(source as EntityId, {
            tenantId,
            organizationIds: [organizationId],
            filters: { id: { $in: ids } },
            fields: ['id', ...TITLE_FIELDS_BACKFILL, ...IS_DONE_FIELDS_BACKFILL],
            includeCustomFields: false,
            page: { page: 1, pageSize: Math.max(ids.length, 1) },
          })
          for (const item of result.items ?? []) {
            const raw = item as Record<string, unknown>
            const todoId = typeof raw.id === 'string' ? raw.id : String(raw.id ?? '')
            if (!todoId) continue
            todoSummaries.set(`${source}:${todoId}`, {
              title: resolveBackfillTodoTitle(raw),
              isDone: resolveBackfillTodoIsDone(raw),
            })
          }
        } catch {
          // non-critical: todo metadata unavailable
        }
      }
    }

    for (const link of todoLinks) {
      try {
        const summary = todoSummaries.get(`${link.todo_source}:${link.todo_id}`)
        const title = summary?.title ?? 'Migrated task'
        const status = summary?.isDone ? 'done' : 'planned'

        await db.insertInto('customer_interactions').values({
          id: link.todo_id,
          organization_id: link.organization_id,
          tenant_id: link.tenant_id,
          interaction_type: 'task',
          title,
          body: null,
          status,
          scheduled_at: null,
          occurred_at: null,
          author_user_id: null,
          appearance_icon: null,
          appearance_color: null,
          source: CUSTOMER_INTERACTION_TODO_ADAPTER_SOURCE,
          entity_id: link.entity_id,
          deal_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        } as any).execute()
        todosMigrated++
        affectedEntityIds.add(link.entity_id)
      } catch (err) {
        errors++
        console.warn(`[backfill] Error migrating todo link ${link.id}:`, err instanceof Error ? err.message : err)
      }
    }

    console.log(`[backfill]   Todo links batch: ${todoLinks.length} processed (total migrated: ${todosMigrated})`)

    if (todoLinks.length < BACKFILL_BATCH_SIZE) break
  }

  // Step 3: Recompute next-interaction projections for affected entities
  console.log(`[backfill] Recomputing projections for ${affectedEntityIds.size} entities...`)
  const entityIdList = Array.from(affectedEntityIds)
  for (let i = 0; i < entityIdList.length; i += PROJECTION_BATCH_SIZE) {
    const batch = entityIdList.slice(i, i + PROJECTION_BATCH_SIZE)
    for (const entityId of batch) {
      try {
        await recomputeNextInteraction(em, entityId)
        projectionsRecomputed++
      } catch (err) {
        errors++
        console.warn(`[backfill] Error recomputing projection for entity ${entityId}:`, err instanceof Error ? err.message : err)
      }
    }
    console.log(`[backfill]   Projections batch: ${Math.min(i + PROJECTION_BATCH_SIZE, entityIdList.length)}/${entityIdList.length}`)
  }

  return { activitiesMigrated, todosMigrated, projectionsRecomputed, errors }
}

const interactionsBackfill: ModuleCli = {
  command: 'interactions:backfill',
  async run(rest) {
    const args = parseArgs(rest)
    const tenantId = String(args.tenantId ?? args.tenant ?? '')
    const organizationId = String(args.organizationId ?? args.orgId ?? args.org ?? '')
    if (!tenantId || !organizationId) {
      console.error('Usage: helios customers interactions:backfill --tenant <tenantId> --org <organizationId>')
      return
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    console.log(`[backfill] Starting interactions backfill for tenant=${tenantId} org=${organizationId}`)

    const result = await backfillInteractions(em, container, { tenantId, organizationId })

    console.log('[backfill] Complete.')
    console.log(`  Activities migrated: ${result.activitiesMigrated}`)
    console.log(`  Todo links migrated: ${result.todosMigrated}`)
    console.log(`  Projections recomputed: ${result.projectionsRecomputed}`)
    console.log(`  Errors/skipped: ${result.errors}`)
  },
}

const customersCliCommands = [seedDictionaries, seedExamples, seedStressTest, interactionsBackfill]

export default customersCliCommands
export async function ensureCustomerCustomFieldDefinitions(
  em: EntityManager,
  tenantId: string | null,
): Promise<void> {
  await ensureCustomFieldDefinitions(em, CUSTOMER_CUSTHELIOS_FIELD_SETS, {
    organizationId: null,
    tenantId,
  })
}
