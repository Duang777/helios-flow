import { Migration } from '@mikro-orm/migrations'

export class Migration20260808120000_commercial extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "commercial_contracts" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text null, "status" text not null default 'draft', "contract_type" text not null default 'sales', "customer_entity_id" uuid null, "project_id" uuid null, "deal_id" uuid null, "amount" numeric(18,2) not null, "currency_code" text not null default 'CNY', "start_date" date null, "end_date" date null, "payment_terms" text null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    )
    this.addSql(`create index "commercial_contracts_customer_idx" on "commercial_contracts" ("customer_entity_id");`)
    this.addSql(`create index "commercial_contracts_project_idx" on "commercial_contracts" ("project_id");`)
    this.addSql(`create index "commercial_contracts_scope_idx" on "commercial_contracts" ("organization_id", "tenant_id");`)

    this.addSql(
      `create table "project_revenues" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "project_id" uuid not null, "contract_id" uuid null, "data_version" text not null default 'actual', "amount" numeric(18,2) not null, "currency_code" text not null default 'CNY', "recognized_on" date not null, "note" text null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    )
    this.addSql(`create index "project_revenues_contract_idx" on "project_revenues" ("contract_id");`)
    this.addSql(`create index "project_revenues_project_idx" on "project_revenues" ("project_id");`)
    this.addSql(`create index "project_revenues_scope_idx" on "project_revenues" ("organization_id", "tenant_id");`)

    this.addSql(
      `create table "project_costs" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "project_id" uuid not null, "contract_id" uuid null, "data_version" text not null default 'actual', "cost_type" text not null default 'other', "amount" numeric(18,2) not null, "currency_code" text not null default 'CNY', "incurred_on" date not null, "note" text null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    )
    this.addSql(`create index "project_costs_contract_idx" on "project_costs" ("contract_id");`)
    this.addSql(`create index "project_costs_project_idx" on "project_costs" ("project_id");`)
    this.addSql(`create index "project_costs_scope_idx" on "project_costs" ("organization_id", "tenant_id");`)

    this.addSql(
      `create table "commercial_invoices" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "contract_id" uuid null, "project_id" uuid null, "customer_entity_id" uuid null, "invoice_no" text null, "status" text not null default 'draft', "amount" numeric(18,2) not null, "currency_code" text not null default 'CNY', "issued_on" date not null, "due_date" date null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    )
    this.addSql(`create index "commercial_invoices_contract_idx" on "commercial_invoices" ("contract_id");`)
    this.addSql(`create index "commercial_invoices_project_idx" on "commercial_invoices" ("project_id");`)
    this.addSql(`create index "commercial_invoices_scope_idx" on "commercial_invoices" ("organization_id", "tenant_id");`)

    this.addSql(
      `create table "commercial_payments" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "customer_entity_id" uuid null, "payment_no" text null, "status" text not null default 'draft', "amount" numeric(18,2) not null, "currency_code" text not null default 'CNY', "paid_on" date not null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    )
    this.addSql(`create index "commercial_payments_customer_idx" on "commercial_payments" ("customer_entity_id");`)
    this.addSql(`create index "commercial_payments_scope_idx" on "commercial_payments" ("organization_id", "tenant_id");`)

    this.addSql(
      `create table "payment_allocations" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "invoice_id" uuid not null, "payment_id" uuid not null, "allocated_amount" numeric(18,2) not null, "allocated_on" date null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    )
    this.addSql(`create index "payment_allocations_invoice_idx" on "payment_allocations" ("invoice_id");`)
    this.addSql(`create index "payment_allocations_payment_idx" on "payment_allocations" ("payment_id");`)
    this.addSql(`create index "payment_allocations_scope_idx" on "payment_allocations" ("organization_id", "tenant_id");`)
  }
}
