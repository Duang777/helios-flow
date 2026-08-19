import type { EntityManager } from '@mikro-orm/postgresql'
import type { GovernanceEvidenceItem } from '../../data/entities'
import { GovernanceFinding } from '../../data/entities'

export type RuleCandidate = {
  ruleId: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  reason: string
  evidenceIds: GovernanceEvidenceItem[]
  subjectType: string
  subjectId: string
  impactSummary?: string | null
  ownerRole?: string | null
  suggestedDueOn?: string | null
  payload?: Record<string, unknown> | null
}

export type RuleRunContext = {
  em: EntityManager
  tenantId: string
  organizationId: string
  asOf: string
}

export type GovernanceRule = {
  id: string
  run: (ctx: RuleRunContext) => Promise<RuleCandidate[]>
}

export type UpsertFindingResult = {
  created: number
  updated: number
}

export async function upsertGovernanceFinding(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string; asOf: string },
  candidate: RuleCandidate,
): Promise<'created' | 'updated'> {
  const existing = await em.findOne(GovernanceFinding, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    ruleId: candidate.ruleId,
    subjectType: candidate.subjectType,
    subjectId: candidate.subjectId,
    asOf: scope.asOf,
    deletedAt: null,
  })

  const now = new Date()
  if (existing) {
    existing.severity = candidate.severity
    existing.title = candidate.title
    existing.reason = candidate.reason
    existing.evidenceIds = candidate.evidenceIds
    existing.impactSummary = candidate.impactSummary ?? null
    existing.ownerRole = candidate.ownerRole ?? null
    existing.suggestedDueOn = candidate.suggestedDueOn ?? null
    existing.payload = candidate.payload ?? null
    existing.detectedAt = now
    existing.updatedAt = now
    if (existing.status === 'dismissed' || existing.status === 'resolved') {
      existing.status = 'open'
    }
    return 'updated'
  }

  em.create(GovernanceFinding, {
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
    ruleId: candidate.ruleId,
    severity: candidate.severity,
    status: 'open',
    title: candidate.title,
    reason: candidate.reason,
    evidenceIds: candidate.evidenceIds,
    subjectType: candidate.subjectType,
    subjectId: candidate.subjectId,
    impactSummary: candidate.impactSummary ?? null,
    ownerRole: candidate.ownerRole ?? null,
    suggestedDueOn: candidate.suggestedDueOn ?? null,
    payload: candidate.payload ?? null,
    detectedAt: now,
    asOf: scope.asOf,
    isSimulation: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })
  return 'created'
}

export async function upsertRuleCandidates(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string; asOf: string },
  candidates: RuleCandidate[],
): Promise<UpsertFindingResult> {
  let created = 0
  let updated = 0
  for (const candidate of candidates) {
    const outcome = await upsertGovernanceFinding(em, scope, candidate)
    if (outcome === 'created') created += 1
    else updated += 1
  }
  return { created, updated }
}
