import { Migration } from '@mikro-orm/migrations'

export class Migration20260808130000_insights extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "kpi_targets" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "metric_key" text not null, "unit" text not null, "period_type" text not null, "period_key" text not null, "target_value" numeric(18,6) not null, "currency_code" text null, "note" text null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    )
    this.addSql(`create index "kpi_targets_scope_idx" on "kpi_targets" ("organization_id", "tenant_id");`)
    this.addSql(
      `create unique index "kpi_targets_natural_key_uniq" on "kpi_targets" ("tenant_id", "organization_id", "metric_key", "period_type", "period_key") where "deleted_at" is null;`,
    )
  }
}
