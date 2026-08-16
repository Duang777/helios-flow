import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'

@Entity({ tableName: 'customer_identity_maps' })
@Index({ name: 'customer_identity_maps_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'customer_identity_maps_source_idx', properties: ['sourceEntityId'] })
@Index({ name: 'customer_identity_maps_canonical_idx', properties: ['canonicalEntityId'] })
export class CustomerIdentityMap {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'source_entity_id', type: 'uuid' })
  sourceEntityId!: string

  @Property({ name: 'source_customer_code', type: 'text', nullable: true })
  sourceCustomerCode?: string | null

  @Property({ name: 'canonical_entity_id', type: 'uuid' })
  canonicalEntityId!: string

  @Property({ name: 'canonical_customer_code', type: 'text', nullable: true })
  canonicalCustomerCode?: string | null

  @Property({ type: 'text' })
  rationale!: string

  @Property({ type: 'text', default: 'active' })
  status: string = 'active'

  @Property({ name: 'is_simulation', type: 'boolean', default: false })
  isSimulation: boolean = false

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

export type GovernanceEvidenceItem = {
  type: string
  id: string
  module: string
}

@Entity({ tableName: 'governance_findings' })
@Index({ name: 'governance_findings_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'governance_findings_status_idx', properties: ['status', 'ruleId'] })
@Index({ name: 'governance_findings_subject_idx', properties: ['subjectType', 'subjectId'] })
@Unique({
  name: 'governance_findings_natural_key_uniq',
  properties: ['tenantId', 'organizationId', 'ruleId', 'subjectType', 'subjectId', 'asOf'],
  options: { where: 'deleted_at IS NULL' },
})
export class GovernanceFinding {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'rule_id', type: 'text' })
  ruleId!: string

  @Property({ type: 'text' })
  severity!: string

  @Property({ type: 'text', default: 'open' })
  status: string = 'open'

  @Property({ type: 'text' })
  title!: string

  @Property({ type: 'text' })
  reason!: string

  @Property({ name: 'evidence_ids', type: 'jsonb' })
  evidenceIds!: GovernanceEvidenceItem[]

  @Property({ name: 'subject_type', type: 'text' })
  subjectType!: string

  @Property({ name: 'subject_id', type: 'uuid' })
  subjectId!: string

  @Property({ name: 'impact_summary', type: 'text', nullable: true })
  impactSummary?: string | null

  @Property({ name: 'owner_role', type: 'text', nullable: true })
  ownerRole?: string | null

  @Property({ name: 'suggested_due_on', type: 'date', nullable: true })
  suggestedDueOn?: string | null

  @Property({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown> | null

  @Property({ name: 'detected_at', type: Date })
  detectedAt!: Date

  @Property({ name: 'as_of', type: 'date' })
  asOf!: string

  @Property({ name: 'is_simulation', type: 'boolean', default: false })
  isSimulation: boolean = false

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
