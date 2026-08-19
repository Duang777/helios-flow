import { Migration } from '@mikro-orm/migrations';

export class Migration20260807144007_projects extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "projects" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text null, "status" text not null default 'draft', "customer_entity_id" uuid null, "deal_id" uuid null, "project_manager_id" uuid null, "product_line_code" text null, "biz_category" text null, "budget_revenue" numeric(18,2) null, "budget_cost" numeric(18,2) null, "forecast_revenue" numeric(18,2) null, "forecast_cost" numeric(18,2) null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "projects_deal_idx" on "projects" ("deal_id");`);
    this.addSql(`create index "projects_customer_entity_idx" on "projects" ("customer_entity_id");`);
    this.addSql(`create index "projects_scope_idx" on "projects" ("organization_id", "tenant_id");`);

    this.addSql(`create table "project_milestones" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "project_id" uuid not null, "name" text not null, "status" text not null default 'planned', "planned_date" date null, "actual_date" date null, "sort_order" int not null default 0, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "project_milestones_project_idx" on "project_milestones" ("project_id");`);
    this.addSql(`create index "project_milestones_scope_idx" on "project_milestones" ("organization_id", "tenant_id");`);

    this.addSql(`create table "project_risks" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "project_id" uuid not null, "title" text not null, "description" text null, "risk_type" text not null default 'other', "status" text not null default 'open', "owner_employee_id" uuid null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "project_risks_project_idx" on "project_risks" ("project_id");`);
    this.addSql(`create index "project_risks_scope_idx" on "project_risks" ("organization_id", "tenant_id");`);
  }

}
