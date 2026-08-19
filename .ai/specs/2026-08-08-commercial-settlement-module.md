# Commercial Settlement Module (M6)

| Field | Value |
|-------|-------|
| Status | implemented |
| Date | 2026-08-08 |
| PRD | [docs/PRD.md](../../docs/PRD.md) §7.8–7.9 / M6 / 场景 I |
| Module | `commercial` (`packages/core/src/modules/commercial/`) |
| Depends on | `projects` (M5), `customers` (UUID links only), `directory` (tenant/org scope) |
| Feeds | `insights` (KPI actuals), `governance` (overdue / over-allocation / revenue-without-cost rules) |

## TLDR

**Key Points:**
- Add first-class **经营结算** (not general ledger): contracts → project revenue/cost facts → invoices → payments → invoice–payment allocations.
- Default money: **CNY, tax-exclusive**; amounts as `numeric` / TS `string` (same as sales/catalog). Metrics per PRD §7.9.

**Scope:**
- Entities + CRUD APIs + backend UI + ACL + commands/events + read metrics API + read-only AI tools
- Project/customer injection: “Create contract”
- Integration tests for CRUD, allocation guards, metric formulas

**Out of scope:** Chart of accounts, vouchers, GL postings, multi-currency FX (keep `currencyCode` field, default `CNY`), tax engines.

**Resolved PRD Q6:** Single module `commercial` (not `contracts` + `billing` split) for M6 — one nav group, one ACL surface, one migration stream. Split later only if size forces it.

## Overview

After M5 delivery projects exist, operators need the commercial chain from contract through cash application so Helios Flow can compute 开票率 / 回款率 / 应收未回 / 逾期未回 without becoming an accounting system.

> **Market Reference:** ERP “AR / contract billing” patterns (Odoo Account, ERPNext) for invoice–payment allocation tables. **Rejected:** full double-entry GL (PRD FIN-06 / principle 10).

## Problem Statement

1. Won deals / projects have no contract or cash facts in-platform.
2. Revenue and cost are only budget/forecast on `projects`; no actual recognition lines.
3. Without allocations, payment totals double-count when one payment covers many invoices (or vice versa).
4. KPI (M7) and governance rules need stable fact tables and documented formulas.

## Proposed Solution

New `@helios/core` module `commercial`, enabled from `apps/helios/src/modules.ts`:

| Resource | Role |
|----------|------|
| `CommercialContract` | Header: customer/project, amount, term, payment terms |
| `ProjectRevenue` | Actual recognized revenue lines (version=`actual`) |
| `ProjectCost` | Actual cost lines (labor / purchase / outsourcing / other) |
| `CommercialInvoice` | Invoice amount, issue/due dates, links contract/project |
| `CommercialPayment` | Payment receipt (cash in) |
| `PaymentAllocation` | Many-to-many invoice↔payment with `allocatedAmount` |

Metrics exposed via `GET /api/commercial/metrics` (and reused by `insights`).

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Module id `commercial` | PRD appendix; plural snake_case; IA label「经营结算」 |
| Soft UUID links to projects/customers | No cross-module ORM (AGENTS.md) |
| Allocations as source of “已核销回款” | PRD §7.9; never Σ payment amount alone for 回款率 |
| Guard: Σ alloc ≤ invoice & ≤ payment | Prevents GOV “超额核销” at write time |
| Optimistic locking on all editable entities | Platform default ON |
| Boundary copy in UI | FIN-06: never promise 科目/凭证/总账 |

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Split `contracts` + `billing` | Extra module tax for one MVP team; same ACL/nav |
| Reuse sales orders as contracts | Different lifecycle; sales already means quotes/orders |
| SPEC-024 financial/GL module | Different product; GL is out of Flow scope |

## User Stories

- **项目经理/商务** 从项目创建合同并登记实际营收/成本，以便经营分析有事实数据。
- **财务运营（非总账）** 登记开票与回款并做核销，以便看开票率/回款率/逾期。
- **管理员** 在 UI 看到“经营结算（非会计总账）”说明，避免范围误解。
- **AI 助手** 在权限内查询合同/开票/回款与指标口径（只读；写入走确认）。

## Architecture

```text
customers.CustomerEntity  --UUID-->  commercial.CommercialContract
projects.Project          --UUID-->        |
                                           +--> ProjectRevenue / ProjectCost
                                           +--> CommercialInvoice
                                                      ^
CommercialPayment -------- PaymentAllocation ---------+
```

```text
UI (CrudForm/DataTable)
    -> /api/commercial/* (makeCrudRoute + custom metrics/allocate)
        -> commands/*.ts (tenant-scoped EM)
            -> entities (soft delete, updated_at)
Events: commercial.contract|revenue|cost|invoice|payment|allocation.*
Widgets: inject “创建合同” on project detail / company detail
Insights/Governance: read facts via API or same-tenant queries (no ORM join across modules)
```

### Commands & Events

Commands (singular entity, past-tense events):

| Command | Event |
|---------|-------|
| `commercial.contracts.create\|update\|delete` | `commercial.contract.created\|updated\|deleted` |
| `commercial.revenues.create\|update\|delete` | `commercial.project_revenue.*` |
| `commercial.costs.create\|update\|delete` | `commercial.project_cost.*` |
| `commercial.invoices.create\|update\|delete` | `commercial.invoice.*` |
| `commercial.payments.create\|update\|delete` | `commercial.payment.*` |
| `commercial.allocations.create\|update\|delete` | `commercial.payment_allocation.*` |

Event IDs: `module.entity.action` with **singular** entity segment.

## Code Norms (MUST)

Mirror `projects` / `customers` / `sales`. Full checklist:

### Module layout

```text
packages/core/src/modules/commercial/
  index.ts                 # Module metadata
  acl.ts                   # commercial.view / commercial.manage (+ optional metrics.view = view)
  setup.ts                 # defaultRoleFeatures, onTenantCreated if needed
  events.ts                # createModuleEvents
  data/entities.ts
  data/validators.ts       # zod; z.infer types
  commands/{contracts,revenues,costs,invoices,payments,allocations,scope}.ts
  api/{contracts,revenues,costs,invoices,payments,allocations}/route.ts
  api/metrics/route.ts     # read-only aggregations
  api/openapi.ts
  lib/metrics.ts           # pure functions; unit-tested against §7.9
  lib/allocationGuards.ts  # over-allocation checks
  backend/...              # list/create/[id] pages per resource + contract detail tabs
  widgets/injection/       # create-contract-from-project / from-company
  ai-tools.ts / ai-agents.ts
  i18n/en.json + zh.json
  migrations/ + .snapshot-helios.json
  AGENTS.md
  __integration__/TC-COM-*.spec.ts
```

### Data & security

- Every entity: `id`, `organization_id`, `tenant_id`, `created_at`, `updated_at`, `deleted_at`, `is_active` where applicable.
- Filter all queries by tenant + org; never expose cross-tenant rows.
- Zod in `data/validators.ts`; commands use forked `EntityManager`.
- Soft delete only (`deletedAt`).
- Amounts: `numeric(18,2)` → TS `string`; `currencyCode` default `'CNY'`; `taxIncluded` default `false` (document; may be column or constant in MVP).
- Cross-module: `projectId`, `customerEntityId`, `dealId` as UUID strings only.
- Optimistic lock: return `updatedAt`; UI via `CrudForm` / `buildOptimisticLockHeader`.

### API / UI

- `makeCrudRoute` for CRUD; custom route only for metrics + compound allocate if needed.
- Client: `apiCall` / `createCrud` / `updateCrud` / `deleteCrud` — never raw `fetch`.
- Forms: `CrudForm`; tables: `DataTable`; loading/errors: `LoadingMessage` / `ErrorMessage`.
- i18n via `useT` / locale files; boundary banner key `commercial.boundary.notGl`.
- DS: semantic status tokens only; no hardcoded `text-red-*`.
- Page metadata: `requireAuth` + `requireFeatures` (not role names).

### Metrics purity

- All §7.9 commercial formulas live in `lib/metrics.ts` with pure inputs (arrays of facts + `asOf` date).
- UI and AI must call the same helper/API — no divergent SQL in pages.

## Data Models

### `commercial_contracts` (`CommercialContract`)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id, tenant_id | uuid | scoped |
| name | text | required |
| code | text nullable | business number |
| status | text | `draft` \| `active` \| `completed` \| `cancelled` |
| contract_type | text | `sales` \| `service` \| `other` |
| customer_entity_id | uuid nullable | → customers |
| project_id | uuid nullable | → projects |
| deal_id | uuid nullable | → customer_deals |
| amount | numeric(18,2) | contract_amount |
| currency_code | text | default `CNY` |
| start_date, end_date | date nullable | |
| payment_terms | text nullable | free text / code |
| is_active, audit, soft delete | | |

### `project_revenues` (`ProjectRevenue`)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id, tenant_id | uuid | |
| project_id | uuid | required |
| contract_id | uuid nullable | |
| data_version | text | MVP: only `actual` (reject others or ignore) |
| amount | numeric(18,2) | recognized_revenue |
| currency_code | text | default CNY |
| recognized_on | date | recognition date / period anchor |
| note | text nullable | |
| is_active, audit, soft delete | | |

### `project_costs` (`ProjectCost`)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id, tenant_id | uuid | |
| project_id | uuid | required |
| contract_id | uuid nullable | |
| data_version | text | `actual` |
| cost_type | text | `labor` \| `purchase` \| `outsourcing` \| `other` |
| amount | numeric(18,2) | cost_amount |
| currency_code | text | |
| incurred_on | date | |
| note | text nullable | |
| is_active, audit, soft delete | | |

### `commercial_invoices` (`CommercialInvoice`)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id, tenant_id | uuid | |
| contract_id | uuid nullable | |
| project_id | uuid nullable | |
| customer_entity_id | uuid nullable | |
| invoice_no | text nullable | |
| status | text | `draft` \| `issued` \| `void` |
| amount | numeric(18,2) | invoice_amount |
| currency_code | text | |
| issued_on | date | |
| due_date | date nullable | for 逾期 |
| is_active, audit, soft delete | | |

### `commercial_payments` (`CommercialPayment`)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id, tenant_id | uuid | |
| customer_entity_id | uuid nullable | |
| payment_no | text nullable | |
| status | text | `draft` \| `posted` \| `void` |
| amount | numeric(18,2) | receipt total |
| currency_code | text | |
| paid_on | date | |
| is_active, audit, soft delete | | |

### `payment_allocations` (`PaymentAllocation`)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id, tenant_id | uuid | |
| invoice_id | uuid | |
| payment_id | uuid | |
| allocated_amount | numeric(18,2) | |
| allocated_on | date nullable | |
| is_active, audit, soft delete | | |

**Write guards (commands):**

1. `Σ allocated(invoice) + new ≤ invoice.amount` (exclude void invoices / soft-deleted).
2. `Σ allocated(payment) + new ≤ payment.amount`.
3. Same tenant/org for invoice, payment, allocation.
4. Currency mismatch → reject (MVP: all CNY).

## Metrics API (§7.9)

`GET /api/commercial/metrics?organizationId=&asOf=YYYY-MM-DD&projectId?&contractId?`

| Key | Formula |
|-----|---------|
| actualRevenue | Σ revenue.amount where data_version=actual |
| actualCost | Σ cost.amount where data_version=actual |
| projectGrossProfit | actualRevenue − actualCost |
| projectGrossMargin | profit / revenue (null if revenue=0) |
| invoiceRate | Σ invoice.amount / Σ contract.amount |
| allocatedPayment | Σ allocation.allocated_amount |
| collectionRate | allocatedPayment / Σ invoice.amount |
| arOutstanding | Σ invoice.amount − Σ alloc for those invoices |
| overdueOutstanding | sum over invoices where due_date < asOf of (invoice.amount − alloc) if > 0 |

Response MUST include: `asOf`, `currencyCode`, `filters`, and a `definitions` map (formula + source tables) for AI/UI tooltips.

## API Contracts

| Method | Path | Feature |
|--------|------|---------|
| CRUD | `/api/commercial/contracts` | view / manage |
| CRUD | `/api/commercial/revenues` | view / manage |
| CRUD | `/api/commercial/costs` | view / manage |
| CRUD | `/api/commercial/invoices` | view / manage |
| CRUD | `/api/commercial/payments` | view / manage |
| CRUD | `/api/commercial/allocations` | view / manage |
| GET | `/api/commercial/metrics` | `commercial.view` |

List filters: `projectId`, `contractId`, `customerEntityId`, `status`, `search`, paging ≤100.

## ACL

| Feature | Grants |
|---------|--------|
| `commercial.view` | List/detail/metrics/AI read |
| `commercial.manage` | All writes |

`setup.ts`: grant both to admin-equivalent default roles (same pattern as `projects`).

## UI / IA

Nav group：**经营结算** (main sidebar), with banner `commercial.boundary.notGl`.

Pages:

1. Contracts list / create / `[id]` tabs: Overview · Revenues · Costs · Invoices · Allocations summary
2. Revenues, Costs, Invoices, Payments, Allocations list+create+edit (filter by project/contract query params)
3. Metrics strip or simple dashboard card on contracts list / project injection widget

Widgets:

- Project detail: “创建合同” → `/backend/commercial/contracts/create?projectId=&customerEntityId=`
- Company detail: same with `customerEntityId`

i18n keys under `commercial.*` (en + zh).

### Frontend Architecture Contract (summary)

| Surface | Server / Client |
|---------|-----------------|
| `page.tsx` route shells | Server where possible; metadata guards |
| CrudForm / DataTable pages | `"use client"` (framework requirement) |
| Injection widgets | `"use client"` |
| Metrics helpers | Shared pure TS in `lib/` (no React) |

Budgets: follow platform defaults; no new global providers.

## AI

Read-only tools: list/get contracts, invoices, payments, metrics with definition text. Agent id e.g. `commercial_assistant`. Mutations only via `prepareMutation` in a later phase if needed — M6 ships read tools first (parity with projects Phase B).

## Migration & Compatibility

- New tables only; no changes to sales GL-ish specs.
- `yarn db:generate` for `commercial` snapshot; ask before `yarn db:migrate`.
- Additive module enable in `modules.ts`.

## Implementation Plan

### Phase A — Facts + CRUD (MVP)

1. Spec (this file) approved
2. Scaffold module: entities, validators, acl, setup, events, AGENTS.md
3. Commands + makeCrudRoute for all six resources + allocation guards
4. `lib/metrics.ts` + unit tests for each §7.9 row that uses commercial facts
5. Backend CRUD pages + i18n + boundary banner
6. Enable module, `yarn generate`, migration
7. Integration: `TC-COM-001` contract→invoice→payment→allocate; reject over-alloc; metrics smoke

### Phase B — Loop polish

1. Project/company injection widgets
2. Contract detail tabs embedding children
3. Metrics panel on contract/project
4. Read-only AI tools/agent
5. Seed helper optional (demo package is M7 GOV-05 — keep separate)

## Integration coverage

| Path | Test |
|------|------|
| `/api/commercial/contracts` CRUD | TC-COM-001 |
| `/api/commercial/allocations` over-alloc 400 | TC-COM-001 |
| `/api/commercial/metrics` formulas | unit + TC-COM-002 |
| UI contract create + allocate | Playwright TC-COM-UI-001 (Phase B) |

## Risks & Impact Review

| Risk | Severity | Mitigation | Residual |
|------|----------|------------|----------|
| Scope creep into GL | High | FIN-06 copy; no account entities | Product pressure |
| Double-count collections | High | Allocations-only for 回款率; unit tests | Mis-taught users |
| Orphan project/customer UUIDs | Low | Soft refs; UI resolve when module present | Broken labels |
| Confuse with SPEC-024 financial | Medium | Distinct module name + docs | Naming drift |
| KPI reads stale definitions | Medium | Single `lib/metrics.ts` | Divergence if forked |

## Final Compliance Report

- [ ] No cross-module ORM relations
- [ ] Tenant/org scoped + soft delete + `updated_at`
- [ ] Feature ACL + defaultRoleFeatures
- [ ] Command-pattern writes + allocation guards
- [ ] Metrics match PRD §7.9
- [ ] UI/docs state 非会计总账
- [ ] Integration tests ship with behavior

## Changelog

| Date | Note |
|------|------|
| 2026-08-08 | Initial M6 commercial settlement spec (draft) |
