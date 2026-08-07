import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

@Entity({ tableName: 'projects' })
@Index({ name: 'projects_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'projects_customer_entity_idx', properties: ['customerEntityId'] })
@Index({ name: 'projects_deal_idx', properties: ['dealId'] })
export class Project {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  code?: string | null

  @Property({ type: 'text', default: 'draft' })
  status: string = 'draft'

  @Property({ name: 'customer_entity_id', type: 'uuid', nullable: true })
  customerEntityId?: string | null

  @Property({ name: 'deal_id', type: 'uuid', nullable: true })
  dealId?: string | null

  @Property({ name: 'project_manager_id', type: 'uuid', nullable: true })
  projectManagerId?: string | null

  @Property({ name: 'product_line_code', type: 'text', nullable: true })
  productLineCode?: string | null

  @Property({ name: 'biz_category', type: 'text', nullable: true })
  bizCategory?: string | null

  @Property({ name: 'budget_revenue', type: 'numeric', precision: 18, scale: 2, nullable: true })
  budgetRevenue?: string | null

  @Property({ name: 'budget_cost', type: 'numeric', precision: 18, scale: 2, nullable: true })
  budgetCost?: string | null

  @Property({ name: 'forecast_revenue', type: 'numeric', precision: 18, scale: 2, nullable: true })
  forecastRevenue?: string | null

  @Property({ name: 'forecast_cost', type: 'numeric', precision: 18, scale: 2, nullable: true })
  forecastCost?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'project_milestones' })
@Index({ name: 'project_milestones_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'project_milestones_project_idx', properties: ['projectId'] })
export class ProjectMilestone {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'project_id', type: 'uuid' })
  projectId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', default: 'planned' })
  status: string = 'planned'

  @Property({ name: 'planned_date', type: 'date', nullable: true })
  plannedDate?: string | null

  @Property({ name: 'actual_date', type: 'date', nullable: true })
  actualDate?: string | null

  @Property({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number = 0

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'project_risks' })
@Index({ name: 'project_risks_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'project_risks_project_idx', properties: ['projectId'] })
export class ProjectRisk {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'project_id', type: 'uuid' })
  projectId!: string

  @Property({ type: 'text' })
  title!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'risk_type', type: 'text', default: 'other' })
  riskType: string = 'other'

  @Property({ type: 'text', default: 'open' })
  status: string = 'open'

  @Property({ name: 'owner_employee_id', type: 'uuid', nullable: true })
  ownerEmployeeId?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
