# Operating Loop Platform Coverage Phase 5

## Tasks

- [x] Task 1: Inbox list/get/accept return `/backend/inbox-ops` hrefs
- [x] Task 2: Add Chinese live-eval prompts for inbox, sales, WMS, workflows, integrations
- [x] Task 3: Allow `inbox_ops_*` tool names in acceptance metadata checks
- [x] Task 4: Cover new hops in operating-loop agent regression
- [x] Task 5: Customer company/person/deal and catalog product tools return `/backend` hrefs
- [x] Task 6: Add Chinese live-eval hops for customers and catalog
- [x] Task 7: Browser + API closed-loop verification

## Verification

- [x] Focused unit tests
  Runner: local
  - `yarn workspace @helios/core test -- src/modules/customers/__tests__/ai-tools/companies-pack.test.ts src/modules/customers/__tests__/ai-tools/people-pack.test.ts src/modules/customers/__tests__/ai-tools/deals-pack.test.ts src/modules/customers/__tests__/ai-tools/_shared.test.ts src/modules/catalog/__tests__/ai-tools/products-pack.test.ts src/modules/catalog/__tests__/ai-tools/merchandising-pack.test.ts src/modules/insights/__tests__/ai-agents.test.ts --runInBand`
  - `node --test scripts/__tests__/operating-loop-acceptance.test.mjs`
- [x] Playwright widget E2E
  Runner: local against `http://localhost:3000`
  - `npx playwright test --config .ai/qa/tests/playwright.config.ts packages/core/src/modules/insights/__integration__/TC-INS-OPERATING-WIDGET-001.spec.ts`
  - 7 passed: list triggers, project/order/product/workflow/inbox/integration detail sheets
- [x] Browser page-trigger smoke
  Runner: ego-browser local
  - Login `admin@acme.com` / org 北京四维图新
  - Digest has `data-operating-loop-digest-ai-trigger`; inbox/sales/customers/catalog/wms/workflows/integrations/projects/invoices/findings show `问经营 AI`
- [x] API chat hop smoke
  Runner: local `POST /api/ai_assistant/ai/chat?agent=insights.operating_loop_assistant`
  - inbox → `inbox_ops_list_proposals` + `/backend/inbox-ops` + 确认卡 wording, no write claim
  - orders → `sales.list_orders` + `/backend/sales/orders/...`
  - companies → `customers.list_companies` + `/backend/customers/companies(-v2)/...`
  - products → `catalog.search_products` + `/backend/catalog/products/...`
