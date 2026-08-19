# Operating Loop Platform Coverage

| Field | Value |
|-------|-------|
| Status | implemented |
| Date | 2026-08-19 |
| Extends | `.ai/specs/2026-08-08-operating-loop-m5-m7-plan.md` |

## TLDR

Keep one orchestrator, `insights.operating_loop_assistant`. Phase 1 wired CRM, sales reads, and catalog onto M5–M7. Phase 2 added sales confirm-required document updates, inbox proposal reads, workflow instance/task reads plus claim/complete, WMS inventory reads, and integration health reads without credentials. Phase 3 added remaining detail/marketplace assistant entries and a confirm-required inbox accept preview. Phase 4 mounted catalog product detail and Playwright coverage. Phase 5 added inbox hrefs, then customer/catalog hrefs, plus live-eval Chinese prompts for the new hops. Writes stay `confirm-required`.

## Closed loop

```text
客户/商机 (customers)
  → 报价/订单 (sales, read + confirm-required status/comment)
  → 收件箱提案 (inbox_ops, read + confirm-required accept)
  → 商品查阅 (catalog, read)
  → 库存查阅 (wms, read)
  → 工作流实例/任务 (workflows, read + confirm-required claim/complete)
  → 项目/里程碑/风险 (projects)
  → 合同/开票/核销 (commercial)
  → KPI (insights)
  → 治理检出 (governance)
  → 集成健康 (integrations, read, no credentials)
  → 人审确认后写入
```

## Phase 1 (done)

- Whitelist existing `customers.*`, `catalog.*` (read), and `sales.list/get` tools.
- Bind page context from `resourceKind`/`resourceId`.
- Inject the operating-loop widget onto customers, sales, and catalog list/detail spots.

## Phase 2 (done)

- `sales.manage_order` / `sales.manage_quote`: update `statusEntryId`, comment, customer/external reference through existing PUT APIs.
- `inbox_ops_list_proposals` / `inbox_ops_get_proposal`.
- Workflows: list/get instances and tasks; claim/complete via existing POST APIs.
- WMS: list warehouses, balances, reservations.
- Integrations: list/get with a credentials-free projection.
- Inject on existing table ids: workflows instances/tasks, WMS inventory balances/reservations, inbox proposals.

## Phase 3 (done)

- Inject the operating-loop widget on inbox proposal detail, workflow instance/task detail, integrations marketplace header, and integration detail header.
- `inbox_ops_accept_action`: keep `isMutation: true`, add `loadBeforeRecord` for pending → accepted preview, then whitelist it.
- Do not whitelist `inbox_ops_categorize_email`.

## Phase 4 (done)

- Mount the operating-loop widget on catalog product CrudForm header.
- Add Playwright detail coverage with self-created fixtures for sales order, catalog product, workflow instance/task, inbox proposal, and integration detail.
- Open the operating-loop sheet with Radix `DialogTrigger` so the first click is not swallowed as an outside close.

## Phase 5 (done)

- Inbox list/get/accept tool results include `/backend/inbox-ops` hrefs so answers can cite a page even when the inbox is empty.
- Expand `OPERATING_LOOP_ACCEPTANCE_PROMPTS` with Chinese hops for inbox proposals, sales orders, WMS balances, workflow tasks, and integration health.
- Do not require `inbox_ops_accept_action` in live-eval; that mutation creates pending confirmation rows. The inbox prompt still requires the model to say 确认卡 and not claim the write happened.
- Customer company/person/deal and catalog product list/get/search results include `/backend` hrefs. Empty lists still return the collection page href.
- Add Chinese live-eval hops for `customers.list_companies` and `catalog.search_products`.

## Out of scope

- Autonomous writes.
- Catalog merchandising bulk mutations (stay on `catalog.merchandising_assistant`).
- WMS receive / adjust / move.
- Integration credential read/write and health-check POST.
- Workflow start / cancel / retry / definition edits.
- Auth, api_keys, dashboards.
- Digest auto-chat and OpenCode Code Mode unification.
