import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@helios/shared/lib/encryption/find'
import { Dictionary, DictionaryEntry, type DictionaryManagerVisibility } from '@helios/core/modules/dictionaries/data/entities'
import { normalizeDictionaryValue, sanitizeDictionaryColor, sanitizeDictionaryIcon } from '@helios/core/modules/dictionaries/lib/utils'
import { CustomFieldEntityConfig, CustomFieldValue } from '@helios/core/modules/entities/data/entities'
import { ensureCustomFieldDefinitions } from '@helios/core/modules/entities/lib/field-definitions'
import { setRecordCustomFields } from '@helios/core/modules/entities/lib/helpers'
import { User } from '@helios/core/modules/auth/data/entities'
import {
  StaffTeam,
  StaffTeamMember,
  StaffTeamMemberActivity,
  StaffTeamMemberAddress,
  StaffTeamMemberComment,
  StaffTeamRole,
} from '../data/entities'
import { E } from '#generated/entities.ids.generated'
import {
  STAFF_TEAM_MEMBER_ACTIVITY_CUSTHELIOS_FIELD_SETS,
  STAFF_TEAM_MEMBER_CUSTHELIOS_FIELD_SETS,
  STAFF_TEAM_MEMBER_FIELDSETS,
} from './customFields'

export type StaffSeedScope = { tenantId: string; organizationId: string }

type DictionarySeedEntry = {
  value: string
  label?: string
  color?: string | null
  icon?: string | null
}

type StaffTeamRoleSeed = {
  key: string
  name: string
  legacyNames?: string[]
  teamKey?: string | null
  description?: string | null
  appearanceIcon?: string | null
  appearanceColor?: string | null
}

type StaffTeamMemberSeed = {
  key: string
  displayName: string
  legacyDisplayNames?: string[]
  teamKey?: string | null
  description?: string | null
  roleKeys: string[]
  tags?: string[]
  userIndex?: number
  customFields?: Record<string, string | number | boolean | null | string[]>
}

type StaffTeamSeed = {
  key: string
  name: string
  legacyNames?: string[]
  description?: string | null
}

type StaffTeamMemberNoteSeed = {
  memberKey: string
  body: string
  appearanceIcon?: string | null
  appearanceColor?: string | null
  authorUserIndex?: number
  daysAgo?: number
}

type StaffTeamMemberActivitySeed = {
  memberKey: string
  activityType: string
  subject?: string | null
  body?: string | null
  appearanceIcon?: string | null
  appearanceColor?: string | null
  authorUserIndex?: number
  daysAgo?: number
  customFields?: Record<string, string | number | boolean | null>
}

type StaffTeamMemberAddressSeed = {
  memberKey: string
  name?: string | null
  purpose?: string | null
  companyName?: string | null
  addressLine1: string
  addressLine2?: string | null
  buildingNumber?: string | null
  flatNumber?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  isPrimary?: boolean
}

const TEAM_ROLE_SEEDS: StaffTeamRoleSeed[] = [
  {
    key: 'backend_engineer',
    name: '后端工程师',
    legacyNames: ['Backend engineer'],
    teamKey: 'engineering',
    description: '负责核心服务、API 和集成能力建设。',
    appearanceIcon: 'lucide:server',
    appearanceColor: '#2563eb',
  },
  {
    key: 'frontend_engineer',
    name: '前端工程师',
    legacyNames: ['Frontend engineer'],
    teamKey: 'engineering',
    description: '负责界面交付和设计系统维护。',
    appearanceIcon: 'lucide:monitor',
    appearanceColor: '#0ea5e9',
  },
  {
    key: 'product_manager',
    name: '产品经理',
    legacyNames: ['Product manager'],
    teamKey: 'product',
    description: '推进产品发现、路线图和交付节奏。',
    appearanceIcon: 'lucide:layout-grid',
    appearanceColor: '#14b8a6',
  },
  {
    key: 'ux_designer',
    name: '体验设计师',
    legacyNames: ['UX designer'],
    teamKey: 'product',
    description: '设计用户流程和界面交互模式。',
    appearanceIcon: 'lucide:pen-tool',
    appearanceColor: '#f97316',
  },
  {
    key: 'devops_engineer',
    name: '运维工程师',
    legacyNames: ['DevOps engineer'],
    teamKey: 'operations',
    description: '维护基础设施、发布链路和交付工具。',
    appearanceIcon: 'lucide:cloud',
    appearanceColor: '#7c3aed',
  },
]

const TEAM_SEEDS: StaffTeamSeed[] = [
  {
    key: 'engineering',
    name: '工程',
    legacyNames: ['Engineering'],
    description: '负责后端、前端和平台交付。',
  },
  {
    key: 'product',
    name: '产品',
    legacyNames: ['Product'],
    description: '负责产品管理、用户研究和设计协作。',
  },
  {
    key: 'operations',
    name: '运营',
    legacyNames: ['Operations'],
    description: '负责基础设施、IT 和内部工具。',
  },
]

const TEAM_MEMBER_SEEDS: StaffTeamMemberSeed[] = [
  {
    key: 'alex_chen',
    displayName: '陈立',
    legacyDisplayNames: ['Alex Chen'],
    teamKey: 'engineering',
    description: '负责平台可靠性的后端负责人。',
    roleKeys: ['backend_engineer'],
    tags: ['后端', '平台'],
    userIndex: 0,
    customFields: {
      years_of_experience: 9,
      hourly_rate: 165,
      currency_code: 'USD',
      employment_date: '2021-03-15',
      employment_type: 'full_time',
      onboarded: true,
      bio: '专注平台工程，负责核心服务稳定性。',
      work_mode: 'hybrid',
      focus_areas: ['API', '可观测性', '基础设施'],
    },
  },
  {
    key: 'priya_nair',
    displayName: '林佳',
    legacyDisplayNames: ['Priya Nair'],
    teamKey: 'engineering',
    description: '负责设计系统协作和前端体验交付。',
    roleKeys: ['frontend_engineer'],
    tags: ['前端', '设计系统'],
    userIndex: 1,
    customFields: {
      years_of_experience: 7,
      hourly_rate: 140,
      currency_code: 'USD',
      employment_date: '2020-11-02',
      employment_type: 'full_time',
      onboarded: true,
      bio: '与设计紧密协作，交付清晰顺手的界面体验。',
      work_mode: 'remote',
      focus_areas: ['设计系统', '无障碍'],
    },
  },
  {
    key: 'marta_lopez',
    displayName: '罗明',
    legacyDisplayNames: ['Marta Lopez'],
    teamKey: 'product',
    description: '负责让产品路线图对齐客户结果。',
    roleKeys: ['product_manager'],
    tags: ['产品', '策略'],
    userIndex: 2,
    customFields: {
      years_of_experience: 10,
      hourly_rate: 155,
      currency_code: 'EUR',
      employment_date: '2019-06-10',
      employment_type: 'full_time',
      onboarded: true,
      bio: '把客户反馈转化为清晰的产品优先级。',
      work_mode: 'hybrid',
      focus_areas: ['路线图', '客户发现'],
    },
  },
  {
    key: 'samir_haddad',
    displayName: '何思远',
    legacyDisplayNames: ['Samir Haddad'],
    teamKey: 'product',
    description: '为后台用户设计工作流和体验模式。',
    roleKeys: ['ux_designer'],
    tags: ['设计', '用户体验'],
    customFields: {
      years_of_experience: 8,
      hourly_rate: 130,
      currency_code: 'GBP',
      employment_date: '2022-02-01',
      employment_type: 'contract',
      onboarded: true,
      bio: '把复杂流程转化为易理解、易操作的界面模式。',
      work_mode: 'remote',
      focus_areas: ['流程设计', '原型验证'],
    },
  },
  {
    key: 'jordan_kim',
    displayName: '金周',
    legacyDisplayNames: ['Jordan Kim'],
    teamKey: 'operations',
    description: '保障环境稳定和发布顺畅。',
    roleKeys: ['devops_engineer'],
    tags: ['运维', '基础设施'],
    customFields: {
      years_of_experience: 6,
      hourly_rate: 150,
      currency_code: 'USD',
      employment_date: '2023-05-08',
      employment_type: 'full_time',
      onboarded: false,
      bio: '负责 CI/CD 流水线和监控看板。',
      work_mode: 'onsite',
      focus_areas: ['持续交付', '安全'],
    },
  },
]

const TEAM_MEMBER_NOTE_SEEDS: StaffTeamMemberNoteSeed[] = [
  {
    memberKey: 'alex_chen',
    body: '复盘 API 延迟指标，并标记两个服务需要做缓存调优。',
    appearanceIcon: 'lucide:message-circle',
    appearanceColor: '#2563eb',
    daysAgo: 14,
  },
  {
    memberKey: 'priya_nair',
    body: '与设计协作刷新后台界面的间距规范。',
    appearanceIcon: 'lucide:pen-tool',
    appearanceColor: '#0ea5e9',
    daysAgo: 9,
  },
  {
    memberKey: 'marta_lopez',
    body: '准备 Q2 路线图评审，并暴露三个客户留存风险。',
    appearanceIcon: 'lucide:clipboard-list',
    appearanceColor: '#14b8a6',
    daysAgo: 21,
  },
  {
    memberKey: 'samir_haddad',
    body: '同步新版入职旅程图，并交接给支持团队。',
    appearanceIcon: 'lucide:map',
    appearanceColor: '#f97316',
    daysAgo: 6,
  },
  {
    memberKey: 'jordan_kim',
    body: '复盘事故预案，并安排备份演练。',
    appearanceIcon: 'lucide:shield-check',
    appearanceColor: '#7c3aed',
    daysAgo: 3,
  },
]

const TEAM_MEMBER_ACTIVITY_SEEDS: StaffTeamMemberActivitySeed[] = [
  {
    memberKey: 'alex_chen',
    activityType: '绩效复盘',
    subject: 'Q1 绩效复盘已完成',
    body: '对齐平台可观测性的扩展优先级。',
    appearanceIcon: 'lucide:clipboard-check',
    appearanceColor: '#2563eb',
    daysAgo: 30,
    customFields: {
      activity_outcome: 'completed',
      follow_up_owner: '陈立',
      requires_follow_up: false,
    },
  },
  {
    memberKey: 'priya_nair',
    activityType: '培训',
    subject: '已完成无障碍能力刷新培训',
    body: '重点覆盖色彩对比度和键盘导航。',
    appearanceIcon: 'lucide:graduation-cap',
    appearanceColor: '#0ea5e9',
    daysAgo: 18,
    customFields: {
      activity_outcome: 'completed',
      follow_up_owner: '林佳',
      requires_follow_up: false,
    },
  },
  {
    memberKey: 'marta_lopez',
    activityType: '认证',
    subject: '产品策略认证',
    body: '覆盖结果导向的路线图实践。',
    appearanceIcon: 'lucide:badge-check',
    appearanceColor: '#16a34a',
    daysAgo: 40,
    customFields: {
      activity_outcome: 'completed',
      follow_up_owner: '罗明',
      requires_follow_up: false,
    },
  },
  {
    memberKey: 'samir_haddad',
    activityType: '入职',
    subject: '新版设计工具走查',
    body: '介绍共享组件库的协作流程。',
    appearanceIcon: 'lucide:user-plus',
    appearanceColor: '#f97316',
    daysAgo: 12,
    customFields: {
      activity_outcome: 'completed',
      follow_up_owner: '何思远',
      requires_follow_up: false,
    },
  },
  {
    memberKey: 'jordan_kim',
    activityType: '排班调整',
    subject: '值班轮换更新',
    body: '将主值班调整到周中覆盖。',
    appearanceIcon: 'lucide:clock-3',
    appearanceColor: '#7c3aed',
    daysAgo: 7,
    customFields: {
      activity_outcome: 'rescheduled',
      follow_up_owner: '金周',
      requires_follow_up: true,
    },
  },
]

const TEAM_MEMBER_ADDRESS_SEEDS: StaffTeamMemberAddressSeed[] = [
  {
    memberKey: 'alex_chen',
    name: '总部工位',
    purpose: '办公地址',
    companyName: 'Helios',
    addressLine1: '120 Market Street',
    city: 'San Francisco',
    region: 'CA',
    postalCode: '94105',
    country: '美国',
    isPrimary: true,
  },
  {
    memberKey: 'priya_nair',
    name: '家庭办公室',
    purpose: '家庭地址',
    addressLine1: '48 Maple Avenue',
    city: 'Austin',
    region: 'TX',
    postalCode: '78701',
    country: '美国',
    isPrimary: true,
  },
  {
    memberKey: 'marta_lopez',
    name: '主要住所',
    purpose: '家庭地址',
    addressLine1: '19 Calle del Prado',
    city: 'Madrid',
    region: 'Community of Madrid',
    postalCode: '28014',
    country: '西班牙',
    isPrimary: true,
  },
  {
    memberKey: 'samir_haddad',
    name: '远程工作点',
    purpose: '邮寄地址',
    addressLine1: '77 Cedar Lane',
    city: 'Manchester',
    region: 'Greater Manchester',
    postalCode: 'M1 1AA',
    country: '英国',
    isPrimary: true,
  },
  {
    memberKey: 'jordan_kim',
    name: '运营中心',
    purpose: '办公地址',
    companyName: 'Helios',
    addressLine1: '350 Harbor Drive',
    city: 'Seattle',
    region: 'WA',
    postalCode: '98101',
    country: '美国',
    isPrimary: true,
  },
]

const STAFF_ACTIVITY_TYPE_DICTIONARY_KEY = 'staff-activity-types'
const STAFF_ADDRESS_TYPE_DICTIONARY_KEY = 'staff-address-types'

const STAFF_ACTIVITY_TYPE_DEFAULTS: DictionarySeedEntry[] = [
  { value: '入职', label: '入职', icon: 'lucide:user-plus', color: '#2563eb' },
  { value: '培训', label: '培训', icon: 'lucide:graduation-cap', color: '#0ea5e9' },
  { value: '绩效复盘', label: '绩效复盘', icon: 'lucide:clipboard-list', color: '#8b5cf6' },
  { value: '认证', label: '认证', icon: 'lucide:badge-check', color: '#16a34a' },
  { value: '休假', label: '休假', icon: 'lucide:calendar-minus', color: '#f59e0b' },
  { value: '排班调整', label: '排班调整', icon: 'lucide:clock-3', color: '#22c55e' },
  { value: '角色变更', label: '角色变更', icon: 'lucide:shuffle', color: '#f97316' },
]

const STAFF_ADDRESS_TYPE_DEFAULTS: DictionarySeedEntry[] = [
  { value: '家庭地址', label: '家庭地址' },
  { value: '邮寄地址', label: '邮寄地址' },
  { value: '办公地址', label: '办公地址' },
]

function uniqueSeedNames(...groups: Array<Array<string | undefined> | undefined>): string[] {
  return Array.from(
    new Set(
      groups
        .flatMap((group) => group ?? [])
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  )
}

function normalizeSeedLookupName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function findSeededRecordByName<T>(
  byName: Map<string, T>,
  currentName: string,
  legacyNames: string[] | undefined,
): T | undefined {
  for (const candidate of uniqueSeedNames([currentName], legacyNames)) {
    const found = byName.get(normalizeSeedLookupName(candidate))
    if (found) return found
  }
  return undefined
}

async function ensureStaffTeamMemberCustomFields(em: EntityManager, scope: StaffSeedScope) {
  const now = new Date()
  let config = await em.findOne(CustomFieldEntityConfig, {
    entityId: E.staff.staff_team_member,
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
  })
  if (!config) {
    config = em.create(CustomFieldEntityConfig, {
      entityId: E.staff.staff_team_member,
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  }
  config.configJson = {
    fieldsets: STAFF_TEAM_MEMBER_FIELDSETS,
    singleFieldsetPerRecord: false,
  }
  config.isActive = true
  config.updatedAt = now
  em.persist(config)

  await ensureCustomFieldDefinitions(em, STAFF_TEAM_MEMBER_CUSTHELIOS_FIELD_SETS, {
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
  })
  await ensureCustomFieldDefinitions(em, STAFF_TEAM_MEMBER_ACTIVITY_CUSTHELIOS_FIELD_SETS, {
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
  })
  await em.flush()
}

async function ensureStaffDictionary(
  em: EntityManager,
  scope: StaffSeedScope,
  definition: { key: string; name: string; description: string },
): Promise<Dictionary> {
  let dictionary = await em.findOne(Dictionary, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    key: definition.key,
    deletedAt: null,
  })
  if (!dictionary) {
    dictionary = em.create(Dictionary, {
      key: definition.key,
      name: definition.name,
      description: definition.description,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      isSystem: true,
      isActive: true,
      managerVisibility: 'default' satisfies DictionaryManagerVisibility,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(dictionary)
    await em.flush()
  }
  return dictionary
}

export async function seedStaffActivityTypes(
  em: EntityManager,
  scope: StaffSeedScope,
) {
  const dictionary = await ensureStaffDictionary(em, scope, {
    key: STAFF_ACTIVITY_TYPE_DICTIONARY_KEY,
    name: '员工活动类型',
    description: '用于员工时间线的活动类型，如培训、复盘和认证。',
  })
  const existingEntries = await em.find(DictionaryEntry, {
    dictionary,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
  })
  const existingByValue = new Map(existingEntries.map((entry) => [entry.normalizedValue, entry]))
  for (const seed of STAFF_ACTIVITY_TYPE_DEFAULTS) {
    const value = seed.value.trim()
    if (!value) continue
    const normalizedValue = normalizeDictionaryValue(value)
    if (!normalizedValue) continue
    const color = sanitizeDictionaryColor(seed.color)
    const icon = sanitizeDictionaryIcon(seed.icon)
    const existing = existingByValue.get(normalizedValue)
    if (existing) {
      let updated = false
      if (!existing.label?.trim() && (seed.label ?? '').trim()) {
        existing.label = (seed.label ?? value).trim()
        updated = true
      }
      if (color !== undefined && existing.color !== color) {
        existing.color = color
        updated = true
      }
      if (icon !== undefined && existing.icon !== icon) {
        existing.icon = icon
        updated = true
      }
      if (updated) {
        existing.updatedAt = new Date()
        em.persist(existing)
      }
      continue
    }
    const entry = em.create(DictionaryEntry, {
      dictionary,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      value,
      normalizedValue,
      label: (seed.label ?? value).trim(),
      color: color ?? null,
      icon: icon ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(entry)
  }
  await em.flush()
}

export async function seedStaffAddressTypes(
  em: EntityManager,
  scope: StaffSeedScope,
) {
  const dictionary = await ensureStaffDictionary(em, scope, {
    key: STAFF_ADDRESS_TYPE_DICTIONARY_KEY,
    name: '员工地址类型',
    description: '用于员工档案的地址类型，如家庭、邮寄和办公地址。',
  })
  const existingEntries = await em.find(DictionaryEntry, {
    dictionary,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
  })
  const existingByValue = new Map(existingEntries.map((entry) => [entry.normalizedValue, entry]))
  for (const seed of STAFF_ADDRESS_TYPE_DEFAULTS) {
    const value = seed.value.trim()
    if (!value) continue
    const normalizedValue = normalizeDictionaryValue(value)
    if (!normalizedValue) continue
    const existing = existingByValue.get(normalizedValue)
    if (existing) {
      if (!existing.label?.trim() && (seed.label ?? '').trim()) {
        existing.label = (seed.label ?? value).trim()
        existing.updatedAt = new Date()
        em.persist(existing)
      }
      continue
    }
    const entry = em.create(DictionaryEntry, {
      dictionary,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      value,
      normalizedValue,
      label: (seed.label ?? value).trim(),
      color: null,
      icon: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(entry)
  }
  await em.flush()
}

async function fillMissingTeamMemberCustomFields(
  em: EntityManager,
  scope: StaffSeedScope,
  member: StaffTeamMember,
  customValues: Record<string, string | number | boolean | null | string[]>,
) {
  const keys = Object.keys(customValues)
  if (!keys.length) return
  const existingValues = await em.find(CustomFieldValue, {
    entityId: E.staff.staff_team_member,
    recordId: member.id,
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
    fieldKey: { $in: keys },
  })
  const existingKeys = new Set(existingValues.map((value) => value.fieldKey))
  const missingValues: Record<string, string | number | boolean | null | string[]> = {}
  for (const key of keys) {
    if (!existingKeys.has(key)) {
      missingValues[key] = customValues[key] ?? null
    }
  }
  if (Object.keys(missingValues).length === 0) return
  await setRecordCustomFields(em, {
    entityId: E.staff.staff_team_member,
    recordId: member.id,
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
    values: missingValues,
  })
}

async function fillMissingActivityCustomFields(
  em: EntityManager,
  scope: StaffSeedScope,
  activity: StaffTeamMemberActivity,
  customValues: Record<string, string | number | boolean | null>,
) {
  const keys = Object.keys(customValues)
  if (!keys.length) return
  const existingValues = await em.find(CustomFieldValue, {
    entityId: E.staff.staff_team_member_activity,
    recordId: activity.id,
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
    fieldKey: { $in: keys },
  })
  const existingKeys = new Set(existingValues.map((value) => value.fieldKey))
  const missingValues: Record<string, string | number | boolean | null> = {}
  for (const key of keys) {
    if (!existingKeys.has(key)) {
      missingValues[key] = customValues[key] ?? null
    }
  }
  if (Object.keys(missingValues).length === 0) return
  await setRecordCustomFields(em, {
    entityId: E.staff.staff_team_member_activity,
    recordId: activity.id,
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
    values: missingValues,
  })
}

export async function seedStaffTeamExamples(
  em: EntityManager,
  scope: StaffSeedScope,
) {
  await seedStaffActivityTypes(em, scope)
  await seedStaffAddressTypes(em, scope)
  await ensureStaffTeamMemberCustomFields(em, scope)
  const now = new Date()
  const teamNames = uniqueSeedNames(
    TEAM_SEEDS.map((seed) => seed.name),
    TEAM_SEEDS.flatMap((seed) => seed.legacyNames ?? []),
  )
  const existingTeams = await findWithDecryption(
    em,
    StaffTeam,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      name: { $in: teamNames },
      deletedAt: null,
    },
    undefined,
    scope,
  )
  const teamByName = new Map(existingTeams.map((team) => [normalizeSeedLookupName(team.name), team]))
  const teamByKey = new Map<string, StaffTeam>()
  for (const seed of TEAM_SEEDS) {
    const existing = findSeededRecordByName(teamByName, seed.name, seed.legacyNames)
    if (existing) {
      let updated = false
      if (existing.name !== seed.name) {
        existing.name = seed.name
        updated = true
      }
      if (existing.description !== (seed.description ?? null)) {
        existing.description = seed.description ?? null
        updated = true
      }
      if (updated) {
        existing.updatedAt = now
        em.persist(existing)
      }
      teamByKey.set(seed.key, existing)
      continue
    }
    const record = em.create(StaffTeam, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      name: seed.name,
      description: seed.description ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    teamByKey.set(seed.key, record)
  }
  await em.flush()

  const roleNames = uniqueSeedNames(
    TEAM_ROLE_SEEDS.map((seed) => seed.name),
    TEAM_ROLE_SEEDS.flatMap((seed) => seed.legacyNames ?? []),
  )
  const existingRoles = await findWithDecryption(
    em,
    StaffTeamRole,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      name: { $in: roleNames },
      deletedAt: null,
    },
    undefined,
    scope,
  )
  const roleByName = new Map(existingRoles.map((role) => [normalizeSeedLookupName(role.name), role]))
  const roleByKey = new Map<string, StaffTeamRole>()
  for (const seed of TEAM_ROLE_SEEDS) {
    const existing = findSeededRecordByName(roleByName, seed.name, seed.legacyNames)
    const teamId = seed.teamKey ? teamByKey.get(seed.teamKey)?.id ?? null : null
    if (existing) {
      let updated = false
      if (existing.name !== seed.name) {
        existing.name = seed.name
        updated = true
      }
      if (existing.teamId !== teamId) {
        existing.teamId = teamId
        updated = true
      }
      if (existing.appearanceIcon !== (seed.appearanceIcon ?? null)) {
        existing.appearanceIcon = seed.appearanceIcon ?? null
        updated = true
      }
      if (existing.appearanceColor !== (seed.appearanceColor ?? null)) {
        existing.appearanceColor = seed.appearanceColor ?? null
        updated = true
      }
      if (existing.description !== (seed.description ?? null)) {
        existing.description = seed.description ?? null
        updated = true
      }
      if (updated) {
        existing.updatedAt = now
        em.persist(existing)
      }
      roleByKey.set(seed.key, existing)
      continue
    }
    const record = em.create(StaffTeamRole, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      teamId,
      name: seed.name,
      description: seed.description ?? null,
      appearanceIcon: seed.appearanceIcon ?? null,
      appearanceColor: seed.appearanceColor ?? null,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    roleByKey.set(seed.key, record)
  }
  await em.flush()

  const users = await findWithDecryption(
    em,
    User,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    },
    undefined,
    { tenantId: scope.tenantId, organizationId: scope.organizationId },
  )
  const sortedUsers = [...users].sort((a, b) => {
    const left = a.email ?? ''
    const right = b.email ?? ''
    return left.localeCompare(right)
  })

  const memberNames = uniqueSeedNames(
    TEAM_MEMBER_SEEDS.map((seed) => seed.displayName),
    TEAM_MEMBER_SEEDS.flatMap((seed) => seed.legacyDisplayNames ?? []),
  )
  const existingMembers = await findWithDecryption(
    em,
    StaffTeamMember,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      displayName: { $in: memberNames },
      deletedAt: null,
    },
    undefined,
    scope,
  )
  const memberByName = new Map(existingMembers.map((member) => [normalizeSeedLookupName(member.displayName), member]))

  const memberByKey = new Map<string, StaffTeamMember>()
  for (const seed of TEAM_MEMBER_SEEDS) {
    const roleIds = seed.roleKeys
      .map((key) => roleByKey.get(key)?.id ?? null)
      .filter((id): id is string => typeof id === 'string')
    const userId = typeof seed.userIndex === 'number'
      ? sortedUsers[seed.userIndex]?.id ?? null
      : null
    const teamId = seed.teamKey ? teamByKey.get(seed.teamKey)?.id ?? null : null
    const existing = findSeededRecordByName(memberByName, seed.displayName, seed.legacyDisplayNames)
    if (existing) {
      let updated = false
      if (existing.displayName !== seed.displayName) {
        existing.displayName = seed.displayName
        updated = true
      }
      if (existing.teamId !== teamId) {
        existing.teamId = teamId
        updated = true
      }
      if (existing.description !== (seed.description ?? null)) {
        existing.description = seed.description ?? null
        updated = true
      }
      if (JSON.stringify(existing.roleIds ?? []) !== JSON.stringify(roleIds)) {
        existing.roleIds = roleIds
        updated = true
      }
      const seedTags = seed.tags ?? []
      if (JSON.stringify(existing.tags ?? []) !== JSON.stringify(seedTags)) {
        existing.tags = seedTags
        updated = true
      }
      if (!existing.userId && userId) {
        existing.userId = userId
        updated = true
      }
      if (updated) {
        existing.updatedAt = now
        em.persist(existing)
      }
      memberByKey.set(seed.key, existing)
      continue
    }
    const record = em.create(StaffTeamMember, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      teamId,
      displayName: seed.displayName,
      description: seed.description ?? null,
      userId,
      roleIds,
      tags: seed.tags ?? [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    memberByKey.set(seed.key, record)
  }
  await em.flush()

  const memberSeedsByName = new Map(TEAM_MEMBER_SEEDS.map((seed) => [seed.displayName.toLowerCase(), seed]))
  const membersInScope = await findWithDecryption(
    em,
    StaffTeamMember,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    },
    undefined,
    scope,
  )
  for (const member of membersInScope) {
    const seed = member.displayName ? memberSeedsByName.get(member.displayName.toLowerCase()) : null
    if (!seed?.customFields) continue
    await fillMissingTeamMemberCustomFields(em, scope, member, seed.customFields)
  }

  const seedDate = (daysAgo?: number) => {
    const date = new Date(now)
    if (typeof daysAgo === 'number') {
      date.setDate(date.getDate() - daysAgo)
    }
    return date
  }

  const memberIds = Array.from(memberByKey.values())
    .map((member) => member.id)
    .filter((id): id is string => typeof id === 'string')

  if (memberIds.length === 0) return

  const existingComments = await findWithDecryption(
    em,
    StaffTeamMemberComment,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      member: { $in: memberIds },
      deletedAt: null,
    },
    { populate: ['member'] },
    scope,
  )
  const commentKeys = new Set(
    existingComments.map((comment) => {
      const memberId = typeof comment.member === 'string' ? comment.member : comment.member.id
      const body = comment.body.trim().toLowerCase()
      return `${memberId}:${body}`
    }),
  )
  for (const seed of TEAM_MEMBER_NOTE_SEEDS) {
    const member = memberByKey.get(seed.memberKey)
    if (!member) continue
    const memberId = member.id
    const body = seed.body.trim()
    const key = `${memberId}:${body.toLowerCase()}`
    if (commentKeys.has(key)) continue
    const authorUserId = typeof seed.authorUserIndex === 'number'
      ? sortedUsers[seed.authorUserIndex]?.id ?? null
      : null
    const createdAt = seedDate(seed.daysAgo)
    const comment = em.create(StaffTeamMemberComment, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      member: em.getReference(StaffTeamMember, memberId),
      body,
      authorUserId,
      appearanceIcon: seed.appearanceIcon ?? null,
      appearanceColor: seed.appearanceColor ?? null,
      createdAt,
      updatedAt: createdAt,
    })
    em.persist(comment)
    commentKeys.add(key)
  }
  await em.flush()

  const existingActivities = await findWithDecryption(
    em,
    StaffTeamMemberActivity,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      member: { $in: memberIds },
    },
    { populate: ['member'] },
    scope,
  )
  const activityByKey = new Map<string, StaffTeamMemberActivity>()
  for (const activity of existingActivities) {
    const memberId = typeof activity.member === 'string' ? activity.member : activity.member.id
    const subject = activity.subject?.trim().toLowerCase() ?? ''
    const body = activity.body?.trim().toLowerCase() ?? ''
    const occurredAt = activity.occurredAt ? activity.occurredAt.toISOString().slice(0, 10) : ''
    const key = `${memberId}:${activity.activityType}:${subject}:${body}:${occurredAt}`
    activityByKey.set(key, activity)
  }
  for (const seed of TEAM_MEMBER_ACTIVITY_SEEDS) {
    const member = memberByKey.get(seed.memberKey)
    if (!member) continue
    const memberId = member.id
    const occurredAt = seedDate(seed.daysAgo)
    const subject = seed.subject?.trim() ?? null
    const body = seed.body?.trim() ?? null
    const key = `${memberId}:${seed.activityType}:${subject?.toLowerCase() ?? ''}:${body?.toLowerCase() ?? ''}:${occurredAt.toISOString().slice(0, 10)}`
    const existing = activityByKey.get(key)
    if (existing) {
      if (seed.customFields) {
        await fillMissingActivityCustomFields(em, scope, existing, seed.customFields)
      }
      continue
    }
    const authorUserId = typeof seed.authorUserIndex === 'number'
      ? sortedUsers[seed.authorUserIndex]?.id ?? null
      : null
    const activity = em.create(StaffTeamMemberActivity, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      member: em.getReference(StaffTeamMember, memberId),
      activityType: seed.activityType,
      subject,
      body,
      occurredAt,
      authorUserId,
      appearanceIcon: seed.appearanceIcon ?? null,
      appearanceColor: seed.appearanceColor ?? null,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(activity)
    activityByKey.set(key, activity)
    if (seed.customFields) {
      await em.flush()
      await fillMissingActivityCustomFields(em, scope, activity, seed.customFields)
    }
  }
  await em.flush()

  const existingAddresses = await findWithDecryption(
    em,
    StaffTeamMemberAddress,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      member: { $in: memberIds },
    },
    { populate: ['member'] },
    scope,
  )
  const addressKeys = new Set(
    existingAddresses.map((address) => {
      const memberId = typeof address.member === 'string' ? address.member : address.member.id
      const line1 = address.addressLine1.trim().toLowerCase()
      const postal = address.postalCode?.trim().toLowerCase() ?? ''
      return `${memberId}:${line1}:${postal}`
    }),
  )
  for (const seed of TEAM_MEMBER_ADDRESS_SEEDS) {
    const member = memberByKey.get(seed.memberKey)
    if (!member) continue
    const memberId = member.id
    const line1 = seed.addressLine1.trim()
    const postalCode = seed.postalCode?.trim() ?? null
    const key = `${memberId}:${line1.toLowerCase()}:${postalCode?.toLowerCase() ?? ''}`
    if (addressKeys.has(key)) continue
    const address = em.create(StaffTeamMemberAddress, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      member: em.getReference(StaffTeamMember, memberId),
      name: seed.name ?? null,
      purpose: seed.purpose ?? null,
      companyName: seed.companyName ?? null,
      addressLine1: line1,
      addressLine2: seed.addressLine2 ?? null,
      buildingNumber: seed.buildingNumber ?? null,
      flatNumber: seed.flatNumber ?? null,
      city: seed.city ?? null,
      region: seed.region ?? null,
      postalCode,
      country: seed.country ?? null,
      latitude: seed.latitude ?? null,
      longitude: seed.longitude ?? null,
      isPrimary: seed.isPrimary ?? false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(address)
    addressKeys.add(key)
  }
  await em.flush()
}
