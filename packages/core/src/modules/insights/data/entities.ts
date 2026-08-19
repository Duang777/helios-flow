import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'

@Entity({ tableName: 'kpi_targets' })
@Index({ name: 'kpi_targets_scope_idx', properties: ['organizationId', 'tenantId'] })
@Unique({
  name: 'kpi_targets_natural_key_uniq',
  properties: ['tenantId', 'organizationId', 'metricKey', 'periodType', 'periodKey'],
  options: { where: 'deleted_at IS NULL' },
})
export class KpiTarget {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'metric_key', type: 'text' })
  metricKey!: string

  @Property({ type: 'text' })
  unit!: string

  @Property({ name: 'period_type', type: 'text' })
  periodType!: string

  @Property({ name: 'period_key', type: 'text' })
  periodKey!: string

  @Property({ name: 'target_value', type: 'numeric', precision: 18, scale: 6 })
  targetValue!: string

  @Property({ name: 'currency_code', type: 'text', nullable: true })
  currencyCode?: string | null

  @Property({ type: 'text', nullable: true })
  note?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
