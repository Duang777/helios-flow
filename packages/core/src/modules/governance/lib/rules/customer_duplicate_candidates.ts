import type { FilterQuery } from '@mikro-orm/core'
import { CustomerCompanyProfile, CustomerEntity } from '../../../customers/data/entities'
import type { RuleCandidate, RuleRunContext } from './upsert'

export const RULE_CUSTOMER_DUPLICATE_CANDIDATES = 'gov.customer_duplicate_candidates'

export function normalizeCustomerName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeDomain(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return trimmed.length > 0 ? trimmed : null
}

export async function runCustomerDuplicateCandidatesRule(
  ctx: RuleRunContext,
): Promise<RuleCandidate[]> {
  const entities = await ctx.em.find(
    CustomerEntity,
    {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      deletedAt: null,
      kind: 'company',
      isActive: true,
    } as FilterQuery<CustomerEntity>,
  )
  if (entities.length < 2) return []

  const entityIds = new Set(entities.map((row) => row.id))
  const profiles = await ctx.em.find(
    CustomerCompanyProfile,
    {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
    } as FilterQuery<CustomerCompanyProfile>,
    { populate: ['entity'] },
  )

  const profileByEntity = new Map<string, CustomerCompanyProfile>()
  for (const profile of profiles) {
    const entityRef = profile.entity
    const entityId = typeof entityRef === 'string' ? entityRef : entityRef?.id
    if (entityId && entityIds.has(entityId)) profileByEntity.set(entityId, profile)
  }

  const byName = new Map<string, CustomerEntity[]>()
  const byDomain = new Map<string, CustomerEntity[]>()
  for (const entity of entities) {
    const nameKey = normalizeCustomerName(entity.displayName)
    if (nameKey) {
      const bucket = byName.get(nameKey) ?? []
      bucket.push(entity)
      byName.set(nameKey, bucket)
    }
    const domain = normalizeDomain(profileByEntity.get(entity.id)?.domain)
    if (domain) {
      const bucket = byDomain.get(domain) ?? []
      bucket.push(entity)
      byDomain.set(domain, bucket)
    }
  }

  const groups = new Map<string, CustomerEntity[]>()
  for (const [key, members] of byName) {
    if (members.length >= 2) groups.set(`name:${key}`, members)
  }
  for (const [key, members] of byDomain) {
    if (members.length >= 2) groups.set(`domain:${key}`, members)
  }

  const candidates: RuleCandidate[] = []
  const emittedSubjects = new Set<string>()
  for (const [groupKey, members] of groups) {
    const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id))
    const primary = sorted[0]
    if (!primary || emittedSubjects.has(primary.id)) continue
    emittedSubjects.add(primary.id)

    const peerIds = sorted.slice(1).map((row) => row.id)
    candidates.push({
      ruleId: RULE_CUSTOMER_DUPLICATE_CANDIDATES,
      severity: 'warning',
      title: `Possible duplicate customers: ${primary.displayName}`,
      reason: `Heuristic collision on ${groupKey} across ${sorted.length} company entities. Suggest an identity map; do not auto-merge or delete sources.`,
      evidenceIds: sorted.slice(0, 6).map((row) => ({
        type: 'customer_entity' as const,
        id: row.id,
        module: 'customers' as const,
      })),
      subjectType: 'customer_entity',
      subjectId: primary.id,
      impactSummary: 'Duplicate customer master data may distort KPI and governance rollups.',
      ownerRole: 'crm_ops',
      payload: {
        groupKey,
        peerEntityIds: peerIds,
        suggestedAction: 'create_identity_map',
      },
    })
  }

  return candidates
}
