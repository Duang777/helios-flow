# Insights KPI + Governance (M7)

| Field | Value |
|-------|-------|
| Status | implemented (insights + governance) |
| Date | 2026-08-08 |
| PRD | [docs/PRD.md](../../docs/PRD.md) §7.9–7.11 / M7 / 场景 J–K |
| Modules | `insights` + `governance` under `packages/core/src/modules/` |
| Depends on | `directory` (org tree), `commercial` (M6 facts), `projects` (M5), `customers` (deals/entities) |
| Upstream | M6 metrics helpers for actuals |

## TLDR

**Key Points:**
- **`insights`**: KPI targets by organization + period; completion rate = aggregated actual ÷ target; company total = **derived sum of child orgs** (no duplicate company source rows).
- **`governance`**: Customer dedupe **mapping** (keep source rows) + structured **findings** from rule runners (and AI suggestions with evidence IDs).

**Scope:**
- KPI CRUD + completion API/UI
- Customer identity mappings
- Finding store + rule pack (built-in detectors) + list/detail UI
- Read AI tools for KPI explanation + finding disposition suggestions (`prepareMutation` for writes)

**Out of scope:** Full business_rules DSL redesign; deleting source customers as “cleanup”; treating simulation packs as real books (GOV-05 labeling only).

**Resolved PRD Q7:** Independent modules — `insights` (KPI) and `governance` (mappings + findings + runners). Shared only via UUID facts and documented metric formulas from `commercial`/`projects`. Do **not** hang governance inside CRM.

## Overview

M7 closes the operating loop: set regional targets, prove actuals from settlement/project facts, and surface cross-table risks with evidence so AI and humans can act without silent deletes.

> **Market Reference:** KPI scorecards (Metabase-style aggregation) + MDM golden-record **mapping** (not merge-delete). **Rejected:** storing fake “actual” overrides by default; hard-deleting duplicate customers.

## Problem Statement

1. No place to store regional revenue/margin/collection targets or show completion rates.
2. Cleaning duplicates by deleting CRM rows destroys auditability (GOV-01/04).
3. Risks (stale deals, delayed milestones, cost overrun, overdue AR, over-allocation) are scattered; no structured finding with evidence IDs.
4. AI needs a stable finding schema (AI-09) for disposition advice.

## Proposed Solution

### Module `insights`

| Resource | Role |
|----------|------|
| `KpiTarget` | Target row: org + period + metricKey + unit + targetValue |

`GET /api/insights/kpi/completion` joins targets with aggregations from `commercial` metrics / project facts (same-tenant service calls or duplicated pure aggregators imported carefully — **prefer HTTP/DI port**, never ORM across modules).

### Module `governance`

| Resource | Role |
|----------|------|
| `CustomerIdentityMap` | `sourceCustomerCode` / `sourceEntityId` → `canonicalCustomerCode` / `canonicalEntityId` + rationale |
| `GovernanceFinding` | Structured finding instance |
| Rule runners | Deterministic detectors producing findings |

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Two modules | Different ACL, IA (经营分析 vs 治理), deployable separately after M6 |
| Actuals never free-typed by default | KPI-02; optional `KpiActualOverride` only if product later requires — **not in M7 MVP** |
| Company rollup = sum(children) | KPI-03 + `Organization.parentId` / `descendantIds` |
| Findings persisted | GOV-03 export/list; AI cites `finding.id` + evidence IDs |
| Rules as code pack first | Fast MVP; config UI later |

## User Stories

- **管理员** 按区域与年度维护营收/毛利/回款目标，并看到完成率。
- **治理运营** 建立客户去重映射且保留源客户。
- **项目/财务运营** 在检出列表看到延期、超预算、逾期未回、超额核销等，并打开证据记录。
- **AI** 解释 KPI 口径，并对 finding 给出原因/证据/责任角色/建议完成日（写入需确认）。

## Architecture

```text
directory.Organization (tree)
        ^
        | organizationId
insights.KpiTarget ----completion----> commercial.metrics + projects facts

customers.CustomerEntity <---map--- governance.CustomerIdentityMap
projects / commercial / customers
        |
        v
governance rule runners --> GovernanceFinding (evidenceIds[])
        |
        v
AI tools (read) + prepareMutation (acknowledge / assign)
```

### Closed loop (M5→M7)

```text
CRM deal/company
  -> projects.Project (+ milestones/risks)
    -> commercial.Contract -> revenue/cost -> invoice/payment/allocation
      -> insights.KpiTarget vs metrics completion
      -> governance findings (delay, overrun, overdue, over-alloc, stale deal, …)
```

## Code Norms (MUST)

Same platform norms as M6/`projects` (tenant scope, commands, makeCrudRoute, CrudForm/DataTable, apiCall, i18n, optimistic lock, DS tokens, no cross-module ORM).

### Additional M7 norms

1. **Metric keys** — enum string stable IDs: `revenue`, `gross_profit`, `gross_margin`, `collection` (extensible). Document unit: `amount` | `ratio`.
2. **Period** — `periodType`: `year` \| `quarter` \| `month`; `periodKey`: `2026` / `2026-Q3` / `2026-08` (validated by zod).
3. **Completion API** must return `actualSource` (`commercial.metrics` / `projects`) and `asOf`.
4. **Findings schema** fixed fields (below); runners may only add typed `payload` json, not replace the envelope.
5. **Idempotent runners** — re-run upserts by natural key `(ruleId, subjectType, subjectId, periodKey?)` to avoid duplicate open findings.
6. **No silent customer delete** in governance commands.
7. **Simulation imports** must set `isSimulation=true` and UI badge (GOV-05).

## Data Models — `insights`

### `kpi_targets` (`KpiTarget`)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id, tenant_id | uuid | target org (region) |
| metric_key | text | `revenue` \| `gross_profit` \| `gross_margin` \| `collection` |
| unit | text | `amount` \| `ratio` |
| period_type | text | year/quarter/month |
| period_key | text | |
| target_value | numeric(18,6) | ratios as 0–1 or 0–100 — **pick 0–100 for % to match deal probability style; document in API** |
| currency_code | text nullable | required when unit=amount; default CNY |
| note | text nullable | |
| is_active, audit, soft delete | | |

Unique (tenant, org, metric_key, period_type, period_key) among non-deleted.

## Data Models — `governance`

### `customer_identity_maps` (`CustomerIdentityMap`)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id, tenant_id | uuid | |
| source_entity_id | uuid | customer_entities.id kept |
| source_customer_code | text nullable | external/code |
| canonical_entity_id | uuid | surviving golden record |
| canonical_customer_code | text nullable | |
| rationale | text | required explanation |
| status | text | `active` \| `retired` |
| is_simulation | boolean | default false |
| is_active, audit, soft delete | | |

### `governance_findings` (`GovernanceFinding`)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id, tenant_id | uuid | |
| rule_id | text | e.g. `gov.project_milestone_delayed` |
| severity | text | `info` \| `warning` \| `critical` |
| status | text | `open` \| `acknowledged` \| `resolved` \| `dismissed` |
| title | text | |
| reason | text | human-readable cause |
| evidence_ids | jsonb | `{ type, id, module }[]` |
| subject_type | text | `project` \| `milestone` \| `deal` \| `invoice` \| `customer` \| … |
| subject_id | uuid | |
| impact_summary | text nullable | |
| owner_role | text nullable | suggested role key |
| suggested_due_on | date nullable | |
| payload | jsonb nullable | rule-specific |
| detected_at | timestamptz | |
| as_of | date | cutoff used |
| is_simulation | boolean | |
| is_active, audit, soft delete | | |

## Built-in rule pack (MVP)

| rule_id | Source | Condition (defaults) |
|---------|--------|----------------------|
| `gov.customer_duplicate_candidates` | customers | heuristic name+tax id collision → finding (map suggested, not auto-merge) |
| `gov.deal_stale` | customers deals | in-progress & last follow-up > 60d |
| `gov.deal_stage_probability_conflict` | deals | stage vs probability dictionary mismatch |
| `gov.project_milestone_delayed` | projects | planned < asOf & actual null |
| `gov.project_cost_over_budget` | projects+commercial | actual cost > budget_cost |
| `gov.revenue_without_cost` | commercial | project has actual revenue & zero actual cost |
| `gov.invoice_overdue_outstanding` | commercial | due_date < asOf & outstanding > 0 |
| `gov.allocation_over_invoice` | commercial | defensive: Σ alloc > invoice (should be blocked at write; still detect legacy) |
| `gov.project_status_conflict` | projects | e.g. project completed but open milestones |

Run via command `governance.rules.run` (org-scoped, `asOf` param) and optional queue job later.

## API Contracts

### insights

| Method | Path | Feature |
|--------|------|---------|
| CRUD | `/api/insights/kpi-targets` | `insights.view` / `insights.manage` |
| GET | `/api/insights/kpi/completion?organizationId&periodType&periodKey&asOf&includeDescendants=` | `insights.view` |

Completion item: `{ organizationId, metricKey, targetValue, actualValue, completionRate, unit, currencyCode, actualSource }`.  
When `includeDescendants=true` for a parent org: return child rows + `rollup` derived sum (amounts) / weighted handling for ratios (**document**: margin rollup = Σ profit / Σ revenue, not avg of rates).

### governance

| Method | Path | Feature |
|--------|------|---------|
| CRUD | `/api/governance/identity-maps` | view / manage |
| CRUD | `/api/governance/findings` | view / manage (status transitions) |
| POST | `/api/governance/rules/run` | `governance.manage` |

## ACL

| Feature | Module |
|---------|--------|
| `insights.view` / `insights.manage` | insights |
| `governance.view` / `governance.manage` | governance |

## UI / IA

Nav：**经营分析**

- KPI 目标 list/create/edit + 完成率看板（区域表 + 公司派生汇总行只读）
- 治理：身份映射 list/create；检出 findings list/detail（证据链接到 `/backend/projects/...`、`/backend/commercial/...`、`/backend/customers/...`）
- Run rules dialog (asOf + confirm)

Banner on simulation data; boundary none for GL (owned by commercial).

### Frontend Architecture Contract (summary)

Same as commercial: client pages for CrudForm/DataTable; pure aggregation in `lib/`; evidence links are plain `<Link>` / `apiCall` reads.

## AI

- `insights`: explain completion + formula definitions (cite commercial metrics definitions).
- `governance`: list open findings; suggest disposition (`prepareMutation` to acknowledge/assign). Never auto-delete customers.
- `insights.operating_loop_assistant`: cross-module operating advisor that can chain projects, commercial settlement, KPI gaps, and governance findings. Project, contract, invoice, payment, allocation, KPI-target, and governance disposition writes stay behind the AI mutation confirmation gate.
- Operating-loop responses should include the number, formula/source table, evidence IDs when applicable, and backend `href` links returned by tools.

## Implementation Plan

### Phase A — insights KPI (after M6 Phase A metrics exist)

1. Scaffold `insights` module
2. `KpiTarget` CRUD + completion API using commercial metrics port
3. Org rollup using directory tree fields
4. Backend KPI UI + i18n
5. Unit tests for rollup/margin; `TC-INS-001`

### Phase B — governance core

1. Scaffold `governance` module
2. Identity map CRUD + GOV-01 tests (source row remains)
3. Finding entity + status commands
4. Rule pack: milestone delay, cost overrun, overdue AR, over-alloc (depends M5/M6 data)
5. Findings UI + run rules
6. `TC-GOV-001` / `TC-GOV-002`

### Phase C — AI + optional simulation

1. Read tools + agents for both modules
2. Optional demo pack import flagged `isSimulation` (GOV-05)
3. Deal stale / stage probability rules (customers)

## File Manifest (target)

| Path | Purpose |
|------|---------|
| `packages/core/src/modules/insights/**` | KPI module |
| `packages/core/src/modules/governance/**` | Maps + findings + runners |
| `apps/helios/src/modules.ts` | enable both |
| `packages/core/src/modules/commercial/lib/metrics.ts` | shared formulas (M6; consumed via API/DI) |

## Testing Strategy

- Unit: rollup, margin, each rule predicate
- Integration: KPI completion matches commercial seed; finding idempotency; identity map keeps source entity
- Playwright: KPI board + findings list (Phase B/C), operating-loop playground selection, and a fixed closed-loop prompt submission without a live model provider
- AI QA: fixed prompt regression set for delayed project, overdue AR, KPI gap, duplicate customer findings, and confirmed finding disposition

## Risks & Impact Review

| Risk | Severity | Mitigation | Residual |
|------|----------|------------|----------|
| Actuals diverge from commercial UI | High | Single metrics library/API | Extra SQL temptation |
| Company target double-counted | High | Forbid company-level source rows OR mark `rollupOnly` | User education |
| Rule noise / alert fatigue | Medium | Severity + dismiss; tune thresholds | Ops load |
| Cross-module query coupling | Medium | Ports/API; no ORM joins | Perf |
| AI writes without confirm | High | prepareMutation only | Misconfig |

## Final Compliance Report

- [ ] Two modules, plural snake_case ids
- [ ] No cross-module ORM; UUID evidence only
- [ ] KPI actuals from facts; rollup derived
- [ ] Dedupe via mapping; no source delete
- [ ] Finding envelope matches GOV-03 / AI-09
- [ ] Integration tests with fixtures
- [ ] Simulation labeling if demo pack ships

## Changelog

| Date | Note |
|------|------|
| 2026-08-08 | Initial M7 insights + governance spec (draft) |
| 2026-08-08 | **insights** implemented: `KpiTarget` CRUD, completion API/UI, org rollup, `TC-INS-001`, AI read tools |
| 2026-08-08 | **governance** implemented: `CustomerIdentityMap` + `GovernanceFinding`, built-in rule pack (milestone delay, cost overrun, revenue-without-cost, overdue AR, over-allocation, deal stale), rules run command/API, admin UI, `TC-GOV-001`, AI read tools + acknowledge mutation tool |
| 2026-08-09 | Operating-loop AI expanded: `insights.operating_loop_assistant`, KPI gap tool, commercial project/overdue/allocation tools, projects delay summary, and governance disposition/bulk acknowledge tools with confirmation-required mutations |
| 2026-08-09 | Operating-loop AI QA added: fixed prompt regression coverage, mutation-tool approval assertions, and Playwright playground submission for `insights.operating_loop_assistant` |
