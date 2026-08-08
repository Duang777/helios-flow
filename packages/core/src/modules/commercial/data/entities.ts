import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

@Entity({ tableName: 'commercial_contracts' })
@Index({ name: 'commercial_contracts_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'commercial_contracts_project_idx', properties: ['projectId'] })
@Index({ name: 'commercial_contracts_customer_idx', properties: ['customerEntityId'] })
export class CommercialContract {
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

  @Property({ name: 'contract_type', type: 'text', default: 'sales' })
  contractType: string = 'sales'

  @Property({ name: 'customer_entity_id', type: 'uuid', nullable: true })
  customerEntityId?: string | null

  @Property({ name: 'project_id', type: 'uuid', nullable: true })
  projectId?: string | null

  @Property({ name: 'deal_id', type: 'uuid', nullable: true })
  dealId?: string | null

  @Property({ type: 'numeric', precision: 18, scale: 2 })
  amount!: string

  @Property({ name: 'currency_code', type: 'text', default: 'CNY' })
  currencyCode: string = 'CNY'

  @Property({ name: 'start_date', type: 'date', nullable: true })
  startDate?: string | null

  @Property({ name: 'end_date', type: 'date', nullable: true })
  endDate?: string | null

  @Property({ name: 'payment_terms', type: 'text', nullable: true })
  paymentTerms?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'project_revenues' })
@Index({ name: 'project_revenues_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'project_revenues_project_idx', properties: ['projectId'] })
@Index({ name: 'project_revenues_contract_idx', properties: ['contractId'] })
export class ProjectRevenue {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'project_id', type: 'uuid' })
  projectId!: string

  @Property({ name: 'contract_id', type: 'uuid', nullable: true })
  contractId?: string | null

  @Property({ name: 'data_version', type: 'text', default: 'actual' })
  dataVersion: string = 'actual'

  @Property({ type: 'numeric', precision: 18, scale: 2 })
  amount!: string

  @Property({ name: 'currency_code', type: 'text', default: 'CNY' })
  currencyCode: string = 'CNY'

  @Property({ name: 'recognized_on', type: 'date' })
  recognizedOn!: string

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

@Entity({ tableName: 'project_costs' })
@Index({ name: 'project_costs_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'project_costs_project_idx', properties: ['projectId'] })
@Index({ name: 'project_costs_contract_idx', properties: ['contractId'] })
export class ProjectCost {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'project_id', type: 'uuid' })
  projectId!: string

  @Property({ name: 'contract_id', type: 'uuid', nullable: true })
  contractId?: string | null

  @Property({ name: 'data_version', type: 'text', default: 'actual' })
  dataVersion: string = 'actual'

  @Property({ name: 'cost_type', type: 'text', default: 'other' })
  costType: string = 'other'

  @Property({ type: 'numeric', precision: 18, scale: 2 })
  amount!: string

  @Property({ name: 'currency_code', type: 'text', default: 'CNY' })
  currencyCode: string = 'CNY'

  @Property({ name: 'incurred_on', type: 'date' })
  incurredOn!: string

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

@Entity({ tableName: 'commercial_invoices' })
@Index({ name: 'commercial_invoices_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'commercial_invoices_contract_idx', properties: ['contractId'] })
@Index({ name: 'commercial_invoices_project_idx', properties: ['projectId'] })
export class CommercialInvoice {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'contract_id', type: 'uuid', nullable: true })
  contractId?: string | null

  @Property({ name: 'project_id', type: 'uuid', nullable: true })
  projectId?: string | null

  @Property({ name: 'customer_entity_id', type: 'uuid', nullable: true })
  customerEntityId?: string | null

  @Property({ name: 'invoice_no', type: 'text', nullable: true })
  invoiceNo?: string | null

  @Property({ type: 'text', default: 'draft' })
  status: string = 'draft'

  @Property({ type: 'numeric', precision: 18, scale: 2 })
  amount!: string

  @Property({ name: 'currency_code', type: 'text', default: 'CNY' })
  currencyCode: string = 'CNY'

  @Property({ name: 'issued_on', type: 'date' })
  issuedOn!: string

  @Property({ name: 'due_date', type: 'date', nullable: true })
  dueDate?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'commercial_payments' })
@Index({ name: 'commercial_payments_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'commercial_payments_customer_idx', properties: ['customerEntityId'] })
export class CommercialPayment {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'customer_entity_id', type: 'uuid', nullable: true })
  customerEntityId?: string | null

  @Property({ name: 'payment_no', type: 'text', nullable: true })
  paymentNo?: string | null

  @Property({ type: 'text', default: 'draft' })
  status: string = 'draft'

  @Property({ type: 'numeric', precision: 18, scale: 2 })
  amount!: string

  @Property({ name: 'currency_code', type: 'text', default: 'CNY' })
  currencyCode: string = 'CNY'

  @Property({ name: 'paid_on', type: 'date' })
  paidOn!: string

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'payment_allocations' })
@Index({ name: 'payment_allocations_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'payment_allocations_invoice_idx', properties: ['invoiceId'] })
@Index({ name: 'payment_allocations_payment_idx', properties: ['paymentId'] })
export class PaymentAllocation {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'invoice_id', type: 'uuid' })
  invoiceId!: string

  @Property({ name: 'payment_id', type: 'uuid' })
  paymentId!: string

  @Property({ name: 'allocated_amount', type: 'numeric', precision: 18, scale: 2 })
  allocatedAmount!: string

  @Property({ name: 'allocated_on', type: 'date', nullable: true })
  allocatedOn?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
