# Feishu Operating Loop Requirement Coverage

## Scope

This file records how the Helios operating-loop implementation maps to the customer-provided Feishu/Lark competition package dated for the January-August 2026 simulated business period.

The running demo company subject is `北京四维图新科技股份有限公司`. The data remains simulated competition data; customer names are public OEM-style labels for scenario readability and must not be presented as real NavInfo business facts.

## Data Package Coverage

| Requirement | Current Coverage | Evidence |
| --- | --- | --- |
| Preserve the business chain from objective to customer, opportunity, project, contract, revenue/cost, invoice, payment, allocation, risks, and actions. | Covered for imported Feishu records through real Helios HTTP APIs. | `scripts/operating-loop-feishu-import.mjs`, `scripts/lib/operating-loop-feishu-writer.mjs` |
| Import source records without using mock AI replies. | Covered. Importer writes real customers, employees, deals, projects, milestones, risks, contracts, revenue/cost facts, invoices, payments, allocations, and KPI targets. | `yarn operating-loop:feishu:import -- --source-org=REG-A --apply` |
| Preserve source keys and raw traceability. | Covered where target entities expose suitable source/code/notes fields. Source IDs are stored in supported fields such as source, codes, descriptions, and notes. | `scripts/lib/operating-loop-feishu-pack.mjs` |
| Do not collapse REG-A/REG-B/REG-C KPI dimensions silently. | Covered by guard. KPI import requires an explicit source org; current local import uses `REG-A` scoped KPI targets. | `validateFeishuOperatingLoopPackage` |
| Company subject shown in Helios matches the Feishu package company. | Covered by branding command and verifier assertion. | `yarn operating-loop:feishu:brand`, `yarn operating-loop:feishu:verify -- --as-of=2026-08-12` |

## Metric Formula Coverage

| Formula / Rule | Current Coverage | Notes |
| --- | --- | --- |
| Actual revenue = sum recognized revenue where data_version is actual. | Covered. | Commercial metrics and KPI completion use actual revenue rows and formula metadata. |
| Actual cost = sum actual cost rows. | Covered. | Commercial metrics and gross margin calculations. |
| Gross profit = revenue - cost. | Covered. | Commercial metrics and KPI completion. |
| Gross margin = gross profit / revenue; null when revenue is zero. | Covered. | Commercial metrics and KPI completion. |
| Invoice rate = sum invoice amount / sum contract amount. | Covered. | `commercial.metrics` and `commercial.explain_metric`. |
| Collection rate = sum allocated amount / sum invoice amount. | Covered. | Allocation relation is used to avoid double counting. |
| AR outstanding = sum invoice amount - allocated amount. | Covered. | Commercial metrics. |
| Overdue outstanding = issued invoice remainder where due_date < asOf. | Covered. | `commercial.list_overdue_invoices` and today digest. |
| KPI completion = actual / target_value for the active period. | Covered for imported scoped targets. | Completion respects month/quarter/year target periods and `asOf`. |
| Weighted opportunity = estimated amount * win probability / 100. | Partially covered. | Deal probability is imported and stored; a dedicated opportunity metric tool/report can be added if required for scorecard display. |
| Stalled opportunity = ongoing opportunity with last follow-up older than 60 days. | Partially covered. | Follow-ups are imported; explicit governance digest surfacing is not yet part of the main today panel. |

## Governance Scenario Coverage

| Scenario | Current Coverage | Evidence |
| --- | --- | --- |
| Duplicate customers. | Covered. | `gov.customer_duplicate_candidates`, identity maps, verifier expects `CUST-0001` and `CUST-0999`. |
| Stage-probability conflict. | Covered. | `gov.deal_stage_probability_conflict`. |
| Project delay. | Covered. | `gov.project_milestone_delayed`, `projects.get_delay_summary`, today digest. |
| Cost over budget. | Covered. | `gov.project_cost_over_budget`. |
| Revenue without cost. | Covered. | `gov.revenue_without_cost`. |
| Overdue payment / overdue receivable. | Covered. | `gov.invoice_overdue_outstanding`, `commercial.list_overdue_invoices`, today digest. |
| Over-allocation. | Covered as a write/import guard. | Importer detects source allocation `IPR-00030` conflict and skips it; `commercial.manage_allocation` rejects over-allocation. A separate governance finding rule can be added if the competition requires it as a finding. |
| Status conflict. | Not yet fully surfaced as a dedicated governance rule. | Needs exact status-conflict definition from the package rubric before implementing a non-fallback rule. |

## AI Operating Loop Coverage

| Requirement | Current Coverage |
| --- | --- |
| Ask across modules: project delay -> contract/payment -> KPI gap -> governance findings. | Covered by `insights.operating_loop_assistant`. |
| Reply with numbers, formula source, evidence IDs, and backend links. | Covered in assistant prompt contracts and tool outputs; real-model regression verifies required markers. |
| Use current page context. | Covered for the M5-M7 pages already wired with Operating Loop trigger context; continued page-by-page smoke testing is still useful. |
| Proactive reminder rather than only passive chat. | Covered by governance-rule-triggered operating-loop digest notification and `/backend/insights/operating-loop/today`. |
| Confirm-required write preview. | Covered for commercial/project/insights/governance write-pack tools; writes remain behind pending-action confirmation. |

## Current Known Gaps

- Full three-region KPI target comparison is intentionally not collapsed into one Helios organization. Current verified import is scoped to `REG-A`. Supporting REG-A/REG-B/REG-C side-by-side KPI scorecards should use a future source-organization dimension or one Helios organization per source region.
- A dedicated opportunity health panel for weighted pipeline and stalled opportunities would make the opportunity part of the Feishu rubric more visible in the main operating digest.
- A dedicated status-conflict governance rule still needs a precise, deterministic conflict definition from the rubric before implementation.
