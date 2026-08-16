import { Migration } from '@mikro-orm/migrations'

export class Migration20260808140000_governance extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "customer_identity_maps" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "source_entity_id" uuid not null, "source_customer_code" text null, "canonical_entity_id" uuid not null, "canonical_customer_code" text null, "rationale" text not null, "status" text not null default 'active', "is_simulation" boolean not null default false, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    )
    this.addSql(
      `create index "customer_identity_maps_scope_idx" on "customer_identity_maps" ("organization_id", "tenant_id");`,
    )
    this.addSql(
      `create index "customer_identity_maps_source_idx" on "customer_identity_maps" ("source_entity_id");`,
    )
    this.addSql(
      `create index "customer_identity_maps_canonical_idx" on "customer_identity_maps" ("canonical_entity_id");`,
    )

    this.addSql(
      `create table "governance_findings" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "rule_id" text not null, "severity" text not null, "status" text not null default 'open', "title" text not null, "reason" text not null, "evidence_ids" jsonb not null, "subject_type" text not null, "subject_id" uuid not null, "impact_summary" text null, "owner_role" text null, "suggested_due_on" date null, "payload" jsonb null, "detected_at" timestamptz not null, "as_of" date not null, "is_simulation" boolean not null default false, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    )
    this.addSql(
      `create index "governance_findings_scope_idx" on "governance_findings" ("organization_id", "tenant_id");`,
    )
    this.addSql(
      `create index "governance_findings_status_idx" on "governance_findings" ("status", "rule_id");`,
    )
    this.addSql(
      `create index "governance_findings_subject_idx" on "governance_findings" ("subject_type", "subject_id");`,
    )
    this.addSql(
      `create unique index "governance_findings_natural_key_uniq" on "governance_findings" ("tenant_id", "organization_id", "rule_id", "subject_type", "subject_id", "as_of") where "deleted_at" is null;`,
    )
  }
}
