# Projects Delivery Module (M5)

| Field | Value |
|-------|-------|
| Status | in-progress |
| Date | 2026-08-07 |
| PRD | [docs/PRD.md](../../docs/PRD.md) §7.7 / M5 |
| Module | `projects` (`packages/core/src/modules/projects/`) |

## TLDR

Add a first-class `projects` module for project delivery: projects, milestones, and project risks. Link to CRM via opaque UUIDs (`customerEntityId`, `dealId`) — no cross-module ORM relations. Support budget vs forecast amounts, milestone delay detection, and risk ownership. This is M5 of the sales-to-cash loop; commercial settlement (M6) and KPI/governance (M7) are out of scope here.

## Overview

Helios Flow PRD 1.8 commits to a delivery layer between won deals and commercial settlement. Operators need to create projects from customers/deals, track milestones, and register delivery risks with owners.

## Problem Statement

1. After a deal closes, delivery work lives outside the CRM with no shared IDs.
2. Milestone slippage and delivery risks are not first-class, so AI/governance cannot cite evidence IDs.
3. Budget vs rolling forecast is required for later cost-overrun rules (M7) but has nowhere to live today.

## Proposed Solution

New `@helios/core` module `projects` enabled from `apps/helios/src/modules.ts`:

- Entities: `Project`, `ProjectMilestone`, `ProjectRisk`
- Commands + `makeCrudRoute` APIs under `/api/projects/*`
- Backend CRUD pages under `/backend/projects/*` (and nested milestone/risk lists)
- ACL: `projects.view` / `projects.manage` (milestones/risks share manage with parent for M5)
- Default delay rule: `plannedDate < asOf` and `actualDate` is null (asOf configurable later; default “now”)

## Architecture

```text
customers.CustomerEntity / CustomerDeal  --UUID-->  projects.Project
                                                      |
                         +----------------------------+----------------------------+
                         |                            |                            |
                 ProjectMilestone              ProjectRisk                   (M6 contract)
```

- Same-module children store `projectId` UUID (no required MikroORM `@ManyToOne` for M5 simplicity; optional later).
- Cross-module: `customerEntityId`, `dealId`, `projectManagerId` are UUIDs only.
- Optimistic locking: all three entities expose `updatedAt`.
- Soft delete via `deletedAt`.

## Data Models

### `projects` (`Project`)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id, tenant_id | uuid | scoped |
| name | text | required |
| code | text nullable | optional business code |
| status | text | `draft` \| `active` \| `on_hold` \| `completed` \| `cancelled` |
| customer_entity_id | uuid nullable | → customers entity |
| deal_id | uuid nullable | → `customer_deals` |
| project_manager_id | uuid nullable | opaque user/staff id |
| product_line_code | text nullable | dict/code |
| biz_category | text nullable | e.g. passenger/commercial |
| budget_revenue, budget_cost | numeric(18,2) nullable | |
| forecast_revenue, forecast_cost | numeric(18,2) nullable | |
| is_active | boolean | default true |
| created_at, updated_at, deleted_at | timestamptz | |

### `project_milestones` (`ProjectMilestone`)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id, tenant_id | uuid | |
| project_id | uuid | parent |
| name | text | |
| status | text | `planned` \| `in_progress` \| `done` \| `cancelled` |
| planned_date | date nullable | |
| actual_date | date nullable | |
| sort_order | int | default 0 |
| is_active, audit, soft delete | | |

Delay (API/list helper, not stored): planned_date set, planned_date < asOf, actual_date null, status not cancelled.

### `project_risks` (`ProjectRisk`)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id, tenant_id | uuid | |
| project_id | uuid | |
| title | text | |
| description | text nullable | |
| risk_type | text | `schedule` \| `cost` \| `scope` \| `other` |
| status | text | `open` \| `mitigating` \| `closed` |
| owner_employee_id | uuid nullable | opaque |
| is_active, audit, soft delete | | |

## API Contracts

| Method | Path | Feature | Notes |
|--------|------|---------|-------|
| GET/POST/PUT/DELETE | `/api/projects/projects` | view / manage | list returns `updatedAt`; GET supports `?id=` |
| GET/POST/PUT/DELETE | `/api/projects/milestones` | view / manage | filter `projectId` |
| GET/POST/PUT/DELETE | `/api/projects/risks` | view / manage | filter `projectId` |

Commands: `projects.projects.create|update|delete`, `projects.milestones.*`, `projects.risks.*`.

Events: `projects.project.*`, `projects.project_milestone.*`, `projects.project_risk.*`.

## UI

- Nav group: Projects (main sidebar, not settings)
- Pages: list / create / `[id]` for projects; milestones and risks list+create+edit (filter by project where practical)
- i18n: `en.json` + `zh.json` under module `i18n/`
- Forms use `CrudForm`; lists use `DataTable` + optimistic lock on delete

## Phasing

### Phase A (this change) — M5 MVP

1. Spec + module scaffold (entities, validators, acl, setup, events)
2. Commands + CRUD APIs for three resources
3. Backend pages + i18n
4. Enable in `modules.ts`, `yarn generate`, migration + snapshot
5. Unit/helper test for delay detection

### Phase B (follow-up)

1. Inject “Create project” from deal/customer detail
2. Project detail tabs embedding milestones/risks
3. AI tools for projects.view
4. Integration tests for CRUD + tenant isolation

### Out of scope (M6/M7)

Contracts, revenue/cost, invoices, payments, KPI targets, governance rules.

## Risks & Impact Review

| Risk | Severity | Mitigation |
|------|----------|------------|
| Confuse with staff `staff_time_projects` | Medium | Distinct module/table names `projects` / `project_*`; docs note delivery vs time-tracking |
| Orphan UUIDs to customers | Low | Accept soft references; UI labels resolve when customers module present |
| Scope creep into commercial | High | Spec/PRD gate; no contract entities here |

## Integration coverage (planned)

- API: `/api/projects/projects`, `/api/projects/milestones`, `/api/projects/risks` (CRUD + tenant scope)
- UI: `/backend/projects`, create, edit; milestone/risk CRUD paths
- Tests: delay helper unit test in Phase A; Playwright CRUD in Phase B

## Final Compliance Report

- [x] No cross-module ORM relations
- [x] Tenant/org scoped entities
- [x] `updated_at` on editable entities
- [x] Feature ACL + `defaultRoleFeatures`
- [x] Command-pattern writes
- [x] PRD M5 exit: create project, flag delay, register risk

## Changelog

| Date | Note |
|------|------|
| 2026-08-07 | Initial spec for M5 projects delivery module |
| 2026-08-07 | Phase A scaffold landed: entities, commands, APIs, backend CRUD, migration, delay unit tests |
