# Implementation Plan: Operating Loop Platform Coverage Phase 4

## Overview

Keep the same orchestrator. Close remaining detail-page assistant holes that Phase 3 left untested or unmounted: catalog product CrudForm header, and Playwright coverage for order, product, workflow instance/task, inbox proposal, and integration detail using self-created fixtures.

## Architecture Decisions

- Reuse existing header injection. Catalog products already expose `crud-form:catalog.product:header` through CrudForm; only the injection table row is missing.
- Create and delete fixtures through public APIs. Do not depend on demo seed rows.
- Inbox extraction needs the configured LLM. If extract cannot produce a proposal, skip that one test with a reason.
- Integration detail uses registered provider ids from `GET /api/integrations`, not tenant seed data.
- Do not add live-model chat assertions. Widget mount plus page-context ids are the contract.

## Task List

- [x] Task 1: Register `crud-form:catalog.product:header` on the operating-loop widget.
- [x] Task 2: Add Playwright detail coverage for sales order, catalog product, workflow instance/task, inbox proposal, and integration.
- [x] Task 3: Cover catalog.product resourceKind in page-context unit tests.

## Out of scope

- Live-model confirmation-card chat
- WMS receive / adjust / move
- Integration credential write / health-check POST
- Workflow start/cancel/retry on the orchestrator

---

# Implementation Plan: Operating Loop Platform Coverage Phase 3

## Overview

Keep the same orchestrator, `insights.operating_loop_assistant`, with `confirm-required` writes. Close the remaining operator entry points and the inbox confirm-write hop that Phase 2 left off the whitelist: proposal/instance/task/integration detail headers, the integrations marketplace header, and `inbox_ops_accept_action` with a typed pending-action preview.

## Architecture Decisions

- Reuse existing `inbox_ops_accept_action`. Add `loadBeforeRecord` so `prepareMutation` can show status `pending` → `accepted` without dumping action payloads.
- Do not whitelist `inbox_ops_categorize_email`.
- Mount the existing operating-loop widget on new header spots. Do not invent a second agent.
- Integrations stay read-only for credentials and health POST. Marketplace and detail headers only pass ids already visible on the page.
- Workflow start/cancel/retry remain off the orchestrator.

## Task List

### Phase 3A: Detail and marketplace entry points

- [x] Task 1: Inject on inbox proposal detail, workflow instance/task detail, integrations marketplace header, and integration detail header.
- [x] Task 2: Map `integrations.marketplace` list tableId in page context.

### Phase 3B: Inbox confirm-required accept

- [x] Task 3: Add `loadBeforeRecord` to `inbox_ops_accept_action`.
- [x] Task 4: Whitelist it on the operating-loop assistant. Keep categorize off.

### Checkpoint

- [x] `yarn generate`
- [x] Focused unit tests for agents, page context, inbox accept preview
- [x] Playwright list coverage includes `/backend/integrations`
- [x] Mutation policy remains `confirm-required`

## Out of scope

- WMS receive / adjust / move
- Integration credential write / health-check POST
- Workflow start / cancel / retry
- Unattended writes, digest auto-chat, Code Mode merge

---

# Implementation Plan: Operating Loop Platform Coverage Phase 2

## Overview

Keep a single orchestrator, `insights.operating_loop_assistant`, with `confirm-required` writes. Close the remaining business hops that Phase 1 left out: sales document status updates, inbox proposal reads, workflow instance/task reads plus claim/complete, WMS inventory reads, and integration health reads without credentials.

## Architecture Decisions

- Reuse existing HTTP APIs through `defineAiTool` / `defineApiBackedAiTool` and `createAiApiOperationRunner`. Do not add in-process chat HTTP.
- Keep agent-level `requiredFeatures` on projects/commercial/insights/governance. New modules stay tool-level ACL so tenants without WMS/workflows/inbox still open the advisor.
- Sales writes update existing quotes/orders only (`statusEntryId`, comment, references). Do not create documents or skip Quote → Order → Invoice.
- Workflow writes are claim/complete only. Do not cancel, retry, start, or patch the state machine.
- WMS and integrations are read-only. Never expose integration credentials. Never adjust/receive/move stock.
- Inbox whitelist is list/get only. `inbox_ops_accept_action` stays off the orchestrator because it creates downstream entities without a typed pending-action preview.
- Page injection mounts only where a real `tableId` or header spot already exists.
- Do not unify OpenCode Code Mode. Do not auto-open chat from digest. Do not unattended writes.

## Task List

### Phase 1: Sales confirm-required writes

- [x] Task 1: Add `sales.manage_order` and `sales.manage_quote` with `isMutation: true` and `loadBeforeRecord`.
- [x] Task 2: Route updates through `PUT /sales/orders` and `PUT /sales/quotes`.

### Checkpoint: Sales writes

- [x] Unit tests cover tool names and `isMutation`.
- [x] Operating-loop whitelist includes the two write tools.

### Phase 2: Workflows

- [x] Task 3: Add read tools for instances and tasks.
- [x] Task 4: Add confirm-required `workflows.claim_task` and `workflows.complete_task`.
- [x] Task 5: Inject the operating-loop widget on `workflows.instances.list` and `workflows.tasks.list`.

### Checkpoint: Workflows

- [x] Tools registered after `yarn generate`.
- [x] Prompt routing mentions 工作流 / 待办任务.

### Phase 3: WMS, integrations, inbox

- [x] Task 6: Add WMS read tools for warehouses, balances, reservations.
- [x] Task 7: Add integrations list/get tools that strip credentials.
- [x] Task 8: Whitelist `inbox_ops_list_proposals` and `inbox_ops_get_proposal`.
- [x] Task 9: Bind page context + inject on existing table ids, including inbox proposals list.

### Checkpoint: Complete

- [x] `yarn generate`
- [x] Focused unit tests for agents, page context, and new tool packs
- [x] Spec and AGENTS.md updated
- [x] Mutation policy remains `confirm-required`

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Sales status UUID vs slug | Medium | Pass `statusEntryId` only; workflow API rejects illegal skips |
| Completing a task with empty formData | Medium | `get_task` returns `formSchema`; complete requires the filled map |
| Integration detail leaking secrets | High | mapResponse whitelist; never return credentials |
| Inbox accept creating orders | High | Do not whitelist `inbox_ops_accept_action` |
| Agent requiredFeatures too wide | Medium | Keep new ACL on tools only |

## Out of scope

- Catalog merchandising bulk writes
- WMS receive / adjust / move
- Integration credential write / health-check POST
- Workflow start / cancel / retry
- Auth, api_keys, dashboards
- Unattended writes, digest auto-chat, Code Mode merge

---

# Implementation Plan: Operating Loop Advisor Closure

## Overview
Turn the current M5-M7 read/write tool chain into a reproducible operating-advisor closure: real business seed data, fixed Chinese prompt regression checks, page-context-aware assistant entry points, and notification evidence from the existing governance rule digest.

## Architecture Decisions
- Seed through the same HTTP APIs operators use, not direct DB writes, so project/commercial/KPI/governance guards stay in force.
- Keep seed explicit and idempotent by seed code; do not add it to default tenant initialization.
- Reuse `insights.operating_loop_assistant` and the existing `resolvePageContext` contract instead of creating another agent.
- Add one shared operating-loop injection widget owned by `insights`, then mount it into detail-page header spots across projects, commercial, insights, and governance.
- Treat live-model QA as an acceptance harness: fixed prompts, required tool sequence, required numeric/formula/href/evidence markers. It may be skipped when provider/app env is missing, but the assertions themselves are unit-tested.

## Task List

### Phase 1: Acceptance Contracts
- [x] Define fixed Chinese operating-loop prompt cases and quality assertions.
- [x] Extend the live eval script to execute every prompt and fail when tool calls, numbers, formulas, hrefs, or evidence markers are missing.
- [x] Add script-level tests for SSE parsing and response quality checks.
- [x] Read Helios app chat as SSE and stop once the observable acceptance contract is satisfied, instead of waiting for the HTTP stream to close.

### Phase 2: Real Seed Package
- [x] Add an explicit HTTP seed script that creates or reuses a delayed project, overdue invoice, KPI gap, duplicate customers, and a critical governance finding.
- [x] Run governance rules after seeding so notifications/digest use real findings.
- [x] Document required env vars and expected seeded IDs.

### Phase 3: Page Context Binding
- [x] Add a reusable Operating Loop Assistant trigger widget with `pageContext` and context pills.
- [x] Add header injection spots to M5-M7 detail pages that do not expose one yet.
- [x] Register the widget against project, contract, invoice, KPI target, and governance finding detail spots.

### Phase 4: Verification
- [x] Run focused unit tests for scripts and AI/page-context helpers.
- [x] Run `yarn generate` after widget/injection-table changes.
- [x] Build affected packages.
- [x] Seed real operating-loop data through app APIs and run governance rules.
- [x] Run live model acceptance against the provider and the Helios app with fixed Chinese prompts.
- [x] Run focused Playwright coverage for operating loop and playground AI surfaces.

## Verification Notes
- `yarn operating-loop:seed` on `http://localhost:3000` created/reused `OPERATING-LOOP-QA` data and produced governance findings including `gov.project_cost_over_budget`, `gov.project_milestone_delayed`, and `gov.invoice_overdue_outstanding`.
- `yarn ai:live-eval` with `LIVE_AI_APP_URL`, `LIVE_AI_ORGANIZATION_ID`, and `LIVE_AI_PROJECT_ID` passed provider model discovery, Responses smoke, operating-loop tool selection, app chat smoke, and all fixed Chinese operating-loop prompt quality checks.
- The real-model path is intentionally strict: failures include the prompt id, missing tools/markers, partial tool calls, and partial text length.
- `npx playwright test --config .ai/qa/tests/playwright.config.ts packages/core/src/modules/insights/__integration__/TC-INS-OPERATING-WIDGET-001.spec.ts packages/core/src/modules/governance/__integration__/TC-AI-OPERATING-QUALITY-002.spec.ts` passed the page-context widget and playground operating-loop UI checks.

## Phase 5: Active Operating Digest

### Goal
Make the operating assistant proactive: after governance rules run, Helios should publish a real, scoped operating-loop digest notification that summarizes critical findings, delayed projects, overdue invoices, overdue AR, and current-month KPI gaps.

### Architecture Decisions
- Keep governance focused on rule detection; put the cross-module operating summary in `insights`.
- Use `governance.rules.run` as the first trigger because it already marks the point where project/commercial/governance signals are fresh.
- Reuse commercial and KPI formula helpers instead of computing AR or completion rates in the subscriber.
- Fail visibly through structured logs if source reads fail; do not silently downgrade to empty metrics.
- Send a feature-scoped notification with `insights.view`, a stable daily group key, i18n title/body keys, and an assistant backend link.

### Task List
- [x] Add commercial overdue-invoice summary helper and tests.
- [x] Add insights operating-loop digest collector and notification payload tests.
- [x] Register `insights.operating_loop.digest` notification type with en/zh i18n.
- [x] Subscribe to `governance.rules.run` and create the proactive digest from real data.
- [x] Extend the full operating-loop integration spec to verify the new notification.
- [x] Run generation, focused tests, affected builds, and budget checks.

### Verification Notes
- `yarn workspace @helios/core test -- metrics operatingLoopDigest --runInBand` passed commercial overdue summary and operating digest payload tests.
- `yarn generate` passed after adding the insights notification type and subscriber.
- `yarn workspace @helios/core build` passed after the proactive digest implementation.
- `npx playwright test --config .ai/qa/tests/playwright.config.ts packages/core/src/modules/governance/__integration__/TC-LOOP-001.spec.ts` passed the full API operating loop and proactive digest notification check.
- `yarn agents:check-budget` passed with the root chain under budget.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Live model behavior is nondeterministic | High | Assert stable observable contracts: tool categories, numbers, formula text, href/evidence markers |
| Seed pollutes normal environments | Medium | Keep it explicit and idempotent; do not hook into `seed:defaults` |
| Page-context widget overexposes data | High | Pass only scoped IDs already visible on the page; runtime/tool ACL still gates reads |
| Injection registry gets stale | Medium | Run `yarn generate` and add tests around context derivation |
| Active digest double-counts or masks source failures | High | Group by organization/asOf; reuse source metric helpers; log failures instead of falling back |

## Phase 6: Chinese-First Presentation Baseline

### Goal
Make the competition/demo app open in Chinese by default while preserving explicit English switching. Remove the most visible English leaks from notification toasts, language menus, and the left navigation surface.

### Architecture Decisions
- Keep `defaultLocale = zh`.
- Treat cookie locale and `HELIOS_FORCE_LOCALE` as explicit preferences.
- Make browser `Accept-Language` detection opt-in via `HELIOS_DETECT_BROWSER_LOCALE=true` so English browsers no longer override the Chinese product default.
- Keep the language switcher working through `/api/auth/locale` and the `locale` cookie.
- Fix visible navigation/i18n keys in the app example module without attempting a risky whole-module translation sweep.

### Task List
- [x] Add request-locale resolver tests for Chinese default, cookie override, forced locale, and opt-in browser detection.
- [x] Update server locale detection to ignore browser language unless explicitly enabled.
- [x] Localize ProfileDropdown language labels through the active dictionary.
- [x] Fix governance rules digest toast translation so raw keys do not render.
- [x] Translate visible Chinese language names and example left-nav/page-title keys.
- [x] Run focused i18n/UI/notification tests and affected package builds.

### Verification Notes
- `yarn workspace @helios/shared test -- forced-locale --runInBand` passed.
- `yarn workspace @helios/ui test -- ProfileDropdown --runInBand` passed.
- `yarn workspace @helios/core test -- notifications.handlers --runInBand` passed.
- `yarn workspace @helios/shared build`, `yarn workspace @helios/ui build`, and `yarn workspace @helios/core build` passed.
- `yarn i18n:check-sync` was later promoted to a required green gate in Phase 7.

## Phase 7: I18n Sync Closure

### Goal
Close the remaining translation-sync debt so the Chinese-first presentation baseline is backed by a green `yarn i18n:check-sync` gate instead of an explanation about pre-existing repository drift.

### Architecture Decisions
- Keep Chinese as the default product locale and keep English as the primary explicit switch target.
- Preserve all translation keys that are referenced by real UI code; do not delete visible Chinese strings just because they were missing from the English reference locale.
- Reuse existing module translations where they already exist, especially app-level `demoFeedback` keys from onboarding.
- Allow the sync tool to create pl/es/de placeholder locale files for commercial, governance, insights, and projects so module translation contracts stay complete while English/Chinese remain the demo-critical paths.

### Task List
- [x] Add app-level `demoFeedback.*` keys to all app locales from the existing onboarding translations.
- [x] Add missing catalog, sales, and dashboard navigation/page keys across locales.
- [x] Run `yarn i18n:check-sync --fix` to sort stale files and create missing module locale files.
- [x] Re-run `yarn i18n:check-sync` and require it to pass.
- [x] Fix release-build type errors exposed by the green-gate pass in AI pending-action confirm, AI chat UI-part streaming, and Operating Loop page-context widgets.
- [x] Promote the broader `yarn i18n:check` gate past blocking usage failures by adding missing UI phone-field, commercial audit, and AI playground tool keys.

### Verification Notes
- `yarn i18n:check-sync` passed with all 53 translation modules in sync.
- `yarn i18n:check` passed with zero missing keys. Remaining hardcoded-string and value-coverage findings are advisory under the current Phase 1 i18n remediation policy.
- `yarn workspace @helios/ai-assistant build` passed after tightening pending-action and UI-part stream types.
- `yarn workspace @helios/core build` passed after aligning the Operating Loop injection widget props with the framework contract.
- `yarn build:app` passed; existing Turbopack NFT trace warnings remain warnings only.
- `yarn jest --config packages/ai-assistant/jest.config.cjs pending-action-contract --runInBand --forceExit` passed.
- `yarn jest --config packages/ai-assistant/jest.config.cjs AiChatConversationRepository --runInBand --forceExit` passed.
- `yarn workspace @helios/core test -- operating-loop-page-context --runInBand` passed.
- `yarn generate` and `yarn build:packages` passed after the missing-key closure.

## Phase 8: Staff Chinese Demo Data Closure

### Goal
Remove the visible English leaks reported on the staff/team-members screen by fixing both the translation layer and the underlying seeded records. The demo should open in Chinese and show Chinese staff navigation, teams, roles, tags, and member descriptions without runtime string replacement.

### Architecture Decisions
- Treat staff seed content as real demo data, not UI fallback text.
- Preserve idempotency by matching both the new Chinese seed names and the legacy English seed names before updating records.
- Update owned seed fields in place so existing demo databases move from `Engineering` / `Backend engineer` style content to Chinese without duplicate teams or roles.
- Keep English support via the `en` locale and explicit language switching; only the Chinese locale and Chinese demo seed are changed.

### Task List
- [x] Translate visible staff navigation/list keys for teams, team members, roles, leave requests, availability, and timesheets.
- [x] Change staff team, role, member, tag, note, activity, and address demo seeds to Chinese.
- [x] Add legacy-name matching so existing English demo seed rows are refreshed in place.
- [x] Re-run staff seed against the local Acme Corp organization to update the running demo database.
- [x] Run generation, i18n sync/check gates, focused staff tests, and browser verification.

### Verification Notes
- `yarn workspace @helios/core build` passed after the seed/idempotency changes.
- `yarn workspace @helios/core test -- scheduleSwitch --runInBand` passed as a focused staff sanity check.
- Local database verification showed teams `工程 / 产品 / 运营`, roles `后端工程师 / 前端工程师 / 产品经理 / 体验设计师 / 运维工程师`, and Chinese member descriptions after `yarn helios staff seed-examples`.
- `yarn i18n:check-sync` passed after the visible navigation key updates.
- `yarn generate` passed after the staff seed and i18n changes.
- Browser verification on `/backend/staff/team-members` found no remaining target English terms from the reported staff, resource planning, media, inbox, checkout, payment, or communication-channel navigation surface.

## Phase 9: Catalog Chinese Demo Data Closure

### Goal
Remove the visible English leaks reported on the products and services list by fixing the catalog example data, injected SEO report copy, and price-kind display. The page should show Chinese product titles, descriptions, categories, field labels, channel labels, SEO report messages, and price-kind text while preserving stable SKU/code fields.

### Architecture Decisions
- Treat catalog example products as real seeded demo data and refresh existing rows by SKU or legacy English handle.
- Keep SKU, field codes, category slugs, and price-kind codes stable because validators and integrations require ASCII identifiers.
- Set example product handles to `null` so the list no longer shows English URL fragments under product titles.
- Localize the list price-kind label through i18n instead of changing persisted price-kind codes.
- Keep the example injection widget translation-backed; no runtime string replacement or mock response layer.

### Task List
- [x] Translate catalog fieldsets, categories, product titles, descriptions, variants, option values, channel labels, and offers.
- [x] Make catalog example seeding refresh legacy English rows in place by SKU or legacy handle.
- [x] Localize the injected catalog SEO report and product-list bulk actions.
- [x] Localize the product-list price-kind display so `sale` renders as `促销价`.
- [x] Re-run catalog example seeding for the local Acme Corp demo organization.
- [x] Browser-verify `/backend/catalog/products` against the reported English strings.

### Verification Notes
- `yarn workspace @helios/core build` passed after the seed and product-list rendering changes.
- `yarn workspace @helios/core test -- ProductsDataTable --runInBand` passed for the localized price-kind rendering path.
- `yarn i18n:check-sync` passed after the catalog/example locale updates.
- `yarn generate` passed after the catalog module and injection widget changes.
- `yarn i18n:check` passed with no missing keys; existing hardcoded-string and locale value-coverage findings remain advisory under the active i18n remediation policy.
- `yarn build:packages` passed and refreshed workspace package dist outputs before the app build.
- `yarn build:app` passed after the full package build; existing Turbopack NFT trace warnings remain warnings only.
- Browser verification on `/backend/catalog/products` found no remaining target English terms for the reported product rows, SEO report, channel labels, legacy handles, or `sale` price-kind text; the SEO widget rendered the real `健康` state after the Chinese product descriptions were extended past the existing quality threshold.

## Phase 10: AI Agent Metadata Chinese Closure

### Goal
Remove the visible English Agent names and descriptions from the global AI assistant picker, AI Agents settings page, and AI Playground while keeping English available through the existing language switcher.

### Architecture Decisions
- Preserve `label` and `description` as English API fallbacks for backward compatibility.
- Add optional `labelKey` and `descriptionKey` to `AiAgentDefinition` and the agents API response.
- Resolve Agent metadata in UI surfaces through the active `useT()` dictionary, falling back to the shipped English fields when a key is absent.
- Search the global launcher against localized labels and descriptions as well as the stable English fallback and agent id.
- Keep Agent ids, allowed tools, system prompts, mutation policies, and RBAC unchanged.

### Task List
- [x] Add translation-key metadata to the AI Agent contract and list API.
- [x] Localize global launcher, AI Agents settings, and Playground Agent display surfaces.
- [x] Add Chinese/English metadata keys for all registered core Agents.
- [x] Add a focused launcher regression covering localized Agent label display and Chinese search.
- [x] Run generation, i18n, package/app builds, and browser verification.

### Verification Notes
- `yarn workspace @helios/ui test -- AiAssistantLauncher --runInBand` passed after adding a localized Agent metadata regression.
- `yarn generate` passed after adding Agent metadata keys to registered core Agent definitions.
- `yarn i18n:check-sync --fix` normalized the updated locale files, and `yarn i18n:check-sync` passed with all translation modules in sync.
- `yarn i18n:check` passed with zero missing keys. Existing hardcoded-string and value-coverage findings remain advisory under the active i18n remediation policy.
- `yarn workspace @helios/ui build`, `yarn workspace @helios/ai-assistant build`, `yarn workspace @helios/core build`, `yarn build:packages`, and `yarn build:app` passed after the Agent metadata localization changes.
- In-app browser verification on `/backend/catalog/categories` confirmed the page shell is Chinese. The plugin could not trigger the hidden global launcher button in its current viewport sandbox, so the Agent picker text is covered by the focused React regression instead of a pixel-click assertion.

## Phase 10.5: Competition Shell Cleanup

### Goal
Keep the running competition environment focused on the operating-loop advisor by removing the generic Helios sales/contact popup from the backend shell.

### Task List
- [x] Remove the backend-shell mount for `DemoFeedbackWidget` so no automatic contact dialog or floating feedback entry appears during demonstrations.
- [x] Keep the component and translations available for templates/onboarding surfaces, but do not render it in the Helios backend product shell.

## Phase 10.6: Module Video Showcase Pipeline

### Goal
Create a repeatable, real-app video pipeline for competition and sales demos: record backend modules with Playwright, generate Chinese and English subtitle sidecars, and keep video artifacts out of git.

### Architecture Decisions
- Use Playwright `recordVideo` for browser footage because it records the same local Helios app the operator will demo.
- Generate `.srt` and `.vtt` subtitle files per scene so the same raw footage can be uploaded with selectable subtitles or later burned into a final cut.
- Keep the first production path dependency-light: no Remotion app is added yet; Remotion or ffmpeg can consume the generated manifest later.
- Provide two scene modes: curated `competition` scenes for the operating-loop story, and generated `all-modules` scenes from the backend route registry for broader module coverage.

### Task List
- [x] Add a Playwright-backed demo recorder that logs in through the real auth API and captures backend pages.
- [x] Add Chinese and English subtitle generation for every recorded scene.
- [x] Add a preview `index.html` and machine-readable `manifest.json` for produced videos.
- [x] Add route-registry-driven all-module scene discovery plus focused script tests.

## Phase 11: Operating Loop Production Closure

### Goal
Move the operating advisor from “competition-stable demo” toward a production-grade closed loop: all already-shipped write tools must stay confirm-required, governance bulk disposition must cover assignment and due dates, page context must be consistent across list/detail surfaces, proactive digest UI must be navigable, Chinese-first presentation must keep shrinking visible English debt, and real-model regression prompts must cover the operational paths operators will demo.

### Current Implementation Baseline
- Confirm-required write tools already exist for `projects.manage_project`, `projects.manage_milestone`, `commercial.manage_contract`, `commercial.manage_invoice`, `commercial.manage_payment`, `commercial.manage_allocation`, and `insights.manage_kpi_target`.
- Governance already supports single `acknowledge_finding`, single `update_finding_disposition`, and batch `acknowledge_findings`.
- `insights.operating_loop_assistant` already allows the write tools above and runs with `mutationPolicy: confirm-required`.
- Phase 11A–11E are closed: bulk governance disposition, prompt expansion, page context, digest UI, and Chinese presentation sweep for operating-loop / inbox surfaces.

### Architecture Decisions
- Do not introduce mock write responses. AI write tools must call existing API/command routes through `createAiApiOperationRunner` or the pending-action confirm handler.
- Preserve AI tool names as frozen contracts. Add new tools only when the current tool shape cannot represent the needed operation.
- Keep write tools additive and confirm-required; do not downgrade policy or bypass `ai_pending_actions`.
- Prefer bulk tools with per-record result arrays over all-or-nothing batch writes so operators see partial failures.
- Use page-context ids that are already visible on the page; downstream tool ACL and tenant/org filters remain authoritative.
- Extend the live-model prompt set with stable observable requirements rather than brittle exact text.

### Phase 11A: Governance Bulk Disposition
- [x] Add `governance.update_findings_disposition` as a confirm-required bulk mutation.
- [x] Support per-record patch fields: `status`, `ownerRole`, `suggestedDueOn`, `impactSummary`.
- [x] Preview the batch as a pending action and execute through `/governance/findings` PUT per record.
- [x] Return per-record `updated` / `failed` results with `href`.
- [x] Add unit coverage for ACL declaration, API runner calls, partial failures, and linked mutation exposure.

### Phase 11A Verification Notes
- Tool already shipped in `packages/core/src/modules/governance/ai-tools.ts` with `isMutation` / `isBulk` / `loadBeforeRecords`.
- Focused unit coverage in `governance-tools.test.ts` covers per-record owner/due/status/impact patches and partial failures with `href`.
- Linked mutation exposure covered in `governance-explain-suggest.test.ts`.

### Phase 11B: Real-Model Prompt Expansion
- [x] Expand `OPERATING_LOOP_ACCEPTANCE_PROMPTS` from 3 prompts to 10+ Chinese prompts across project delay, overdue AR, KPI gap, governance disposition, write suggestions, and page-context follow-ups.
- [x] Require tool sets appropriate to each prompt, not one global tool list.
- [x] Keep assertions on numbers, formula/source, evidence IDs, and `/backend/` links.
- [x] Add script unit tests so new prompts cannot silently miss required tool metadata.
- [x] Add platform-hop prompts for inbox proposals, sales orders, WMS balances, workflow tasks, and integration health. Inbox live-eval lists proposals and requires 确认卡 wording; it does not call `inbox_ops_accept_action`.

### Phase 11C: Page Context Coverage
- [x] Inventory M5-M7 list/detail pages and existing widget injection spots.
- [x] Add missing list-page assistant triggers with `organizationId` and visible filter context.
- [x] Normalize entity-specific page context fields for project, milestone, risk, contract, invoice, payment, allocation, KPI target, finding, and identity map.
- [x] Add focused page-context tests for each entity mapping.

### Phase 11C Verification Notes
- `DataTable` now merges host `injectionContext` with organization scope, search, visible filters, pagination, total matching count, row count, and selected row ids for all `data-table:*` injection spots.
- `insights.injection.operating-loop-trigger` now supports `operating_loop.list` and `operating_loop.detail` contexts, with stable `extra` ids for project, milestone, risk, contract, invoice, payment, allocation, KPI target, finding, identity map, and customer entity.
- The Operating Loop Assistant is mounted on M5-M7 list search-trailing slots plus missing CrudForm detail header slots for milestones, risks, payments, allocations, and identity maps.
- AI runtime page-context hydration now supports list contexts with `entityType + tableId`, so list filters and scoped ids reach the agent system prompt instead of being dropped when `recordId` is absent.
- Focused tests passed: `yarn workspace @helios/core test -- operating-loop-page-context ai-agents --runInBand`, `yarn workspace @helios/ui test -- DataTable.extensions --runInBand`, and `yarn jest --config packages/ai-assistant/jest.config.cjs agent-runtime --runInBand --forceExit`.

### Phase 11D: Proactive Digest UI
- [x] Add or enhance a Today Operating Digest page/panel with grouped critical findings, overdue invoices, delayed projects, and KPI gaps.
- [x] Make notification actions deep-link to the digest and source records.
- [x] Add aggregation states: empty, partial source failure, and grouped-by-severity.
- [x] Cover with focused component/integration tests and a Playwright smoke path.

## Phase 13: Demo-Ready Operating Advisor Click Path

### Goal
Make the competition path executable through real product surfaces:
login/home or notifications -> Today Operating Digest -> overdue receivables / delayed projects / KPI gaps -> source record or scoped Operating Loop Assistant -> disposition suggestion -> confirm-required mutation preview.

### Architecture Decisions
- Move the proactive digest notification from the AI Playground into a first-class Insights backend page.
- Add a real Insights API for today's operating digest details; do not compute demo-only summaries in the browser.
- Reuse existing project delay, commercial overdue AR, KPI completion, and governance finding口径 so numbers match tools and agent answers.
- Every digest item carries `organizationId`, `entityType`, `recordId`, source href, formula source, and enough scoped ids for the assistant to choose the right tool.
- The assistant sheet opens with context-specific Chinese prompt suggestions, including a confirm-required preview prompt that routes through existing write tools.
- Keep source-record links separate from AI prompts so an operator can inspect evidence before asking the advisor to act.

### Task List
- [x] Add `GET /api/insights/operating-loop/today` returning grouped real records, metric counts, source statuses, formula sources, and hrefs.
- [x] Change `insights.operating_loop.digest` notification links to `/backend/insights/operating-loop/today`.
- [x] Add the Today Operating Digest backend page with grouped critical findings, overdue receivables, delayed projects, and KPI gaps.
- [x] Add per-item source links and per-item Operating Loop Assistant buttons with page context.
- [x] Add empty, loading, source-error, and partial-source states.
- [x] Add i18n keys for Chinese default and English switching.
- [x] Add focused tests for the digest API/detail builders, notification link, page context, and browser smoke path.

### Verification Notes
- `GET /api/insights/operating-loop/today` returns real grouped signals from governance findings, commercial invoices/payments, project milestones, and KPI completion.
- Proactive operating-loop notification link now opens `/backend/insights/operating-loop/today`.
- Browser smoke on local `http://localhost:3000/backend/insights/operating-loop/today` passed after logging in as the demo admin: the page rendered Chinese copy, 4 digest groups, real overdue receivables and delayed projects, formula sources, source-record links, and the Operating Advisor sheet.
- Focused tests passed: `yarn workspace @helios/core test -- operatingLoopDigest operatingLoopToday operating-loop-page-context --runInBand`.
- Build gates passed: `yarn i18n:check-sync`, `yarn generate`, `yarn workspace @helios/core build`, `yarn build:packages`, and `yarn build:app --force`.

### Phase 11E: Chinese Presentation Sweep
- [x] Use `yarn i18n:check` baseline to detect new advisory debt.
- [x] Sweep high-visibility M5-M7 screens and AI surfaces for English strings that are not stable ids/codes.
- [x] Translate user-facing demo data while preserving codes, SKUs, UUIDs, provider names, and technical integration names where appropriate.
- [x] Keep English switching via locale dictionaries.

### Phase 11E Verification Notes
- `yarn i18n:check` stayed green; refreshed `scripts/i18n-advisory-baseline.json` after intentional zh cleanup (`values.zh.identicalSignificant` 3881 → 3759).
- Insights Today Digest / operating-loop zh copy no longer keeps English loanwords like `critical` / `confirm-required` / `prompt` on operator-facing strings.
- Inbox Ops zh dictionary rewritten end-to-end (was mixed broken bilingual); English locale unchanged. SKU / ID / JSON / RFQ kept where technical.
- Demo-data Chinese closure for staff and catalog already landed in Phases 8–9; this slice did not reseed.
- Remaining larger identical-zh pockets: WMS config surfaces (~595), workflow editor placeholders, a few catalog technical labels. Track separately if a demo path hits them.

## Phase 12: Build Trace Warning Closure

### Goal
Turn the long-standing `yarn build:app` Turbopack/NFT trace warning into a fixed build hygiene issue instead of another advisory explanation. The app build should no longer report `apps/helios/next.config.ts Encountered unexpected file in NFT list` through queue, AI assistant generated-registry, or QA event import chains.

### Root Cause
- The local queue strategy and the pending-job probe resolved their default storage path from a relative `.helios/queue` value at module runtime.
- The AI Assistant standalone generated-registry loader legitimately probes generated registry files on disk for CLI/MCP runtimes.
- The example QA event route persists captured server events to a runtime `.helios/qa-events.jsonl` file.
- Next/Turbopack's NFT tracer sees cwd-relative filesystem paths inside server-imported packages/routes as potentially unbounded project-root access, so it traced the app tree and surfaced `next.config.ts` as an unexpected file.
- The runtime behavior is intentional: local queues, standalone generated-registry loading, and QA event capture should keep their existing storage/search contracts.

### Architecture Decisions
- Keep the local queue strategy and `QUEUE_BASE_DIR` contract unchanged.
- Add a shared queue helper that resolves default and relative local queue paths from `process.cwd()` at runtime, annotated with Turbopack's `turbopackIgnore` marker so the build tracer does not expand the whole project.
- Reuse the helper from both the writer path (`createLocalQueue`) and the read-only pending probe to avoid future divergence.
- Mark AI Assistant standalone generated-registry filesystem probes as runtime-only while preserving the Next app's preferred `@/.helios/generated/*` import path.
- Mark example QA event persistence as runtime-only; it is not a build input and must remain best-effort.
- Guard path semantics with queue unit tests instead of relying only on app build output.

### Task List
- [x] Reproduce the existing `yarn build:app` warning and capture the queue/event/core import trace.
- [x] Add `resolveLocalQueueBaseDir` for local queue path resolution.
- [x] Wire local strategy and pending probe through the helper.
- [x] Add focused tests for default cwd resolution and relative `QUEUE_BASE_DIR` probing.
- [x] Mark AI Assistant generated-registry filesystem probes as runtime-only and run focused loader tests.
- [x] Mark example QA event persistence as runtime-only and re-run generation.
- [x] Run queue tests, package builds, app build, and git hygiene checks.

### Verification Notes
- `yarn workspace @helios/queue test -- local.strategy pending-probe --runInBand` passed.
- `yarn jest --config packages/ai-assistant/jest.config.cjs generated-registry-loader --runInBand --forceExit` passed.
- `yarn workspace @helios/queue build` and `yarn workspace @helios/ai-assistant build` passed; generated package dist kept the `turbopackIgnore` markers.
- `yarn generate` passed with generated outputs unchanged.
- `yarn build:app --force` passed with no Turbopack/NFT trace warnings.

## Phase 14: Feishu Test Package Ingestion

### Goal
Turn the customer-provided Feishu/Lark test data package into real Helios operating-loop data without mock replies or fallback rules. The import path should read the authorized spreadsheet, normalize and validate the rows, then write through the same HTTP APIs used by operators so tenant scoping, ACL, optimistic locking, and command side effects remain active.

### Source Package
- Guide document: authorized Feishu wiki copy provided by the user.
- Data spreadsheet: authorized Feishu wiki spreadsheet copy provided by the user.
- Sheet coverage: organization, employee, customer, opportunity, opportunity_followup, project, project_milestone, project_risk, contract, project_revenue, project_cost, invoice, payment, invoice_payment_relation, and kpi_target.
- Period and口径: January-August 2026 business data, CNY, amount fields are tax-exclusive, opportunity probability is 0-100, project gross-margin targets are decimals.

### Architecture Decisions
- Keep Feishu credentials in environment variables only. Do not commit app secrets, tenant tokens, downloaded private sheets, or local operational files.
- Split source reading, normalization/validation, and HTTP writes into separate script modules so the importer can be tested without network access.
- Preserve Feishu source ids in supported codes, tags, notes, or source fields; do not coerce non-UUID external ids into Helios UUID fields.
- Import employees through the real staff team-member API before project/risk writes so负责人 fields can reference real staff UUIDs.
- Treat Feishu business org codes such as `REG-A` as source dimensions, not Helios tenant organizations. KPI target imports must use an explicit source-org scope or an explicit future dimension model; never silently collapse REG-A/REG-B/REG-C rows into one target.
- Write through existing customer, staff, projects, commercial, insights, and governance APIs. Do not add direct database writes for this package.

### Task List
- [x] Add a Feishu package reader/normalizer with exact sheet-header validation and source-id preserving mappings.
- [x] Add small script tests covering header validation, reference validation, KPI dimension safety, key business mappings, and dry-run command boundaries.
- [x] Add an API-backed importer that logs in to Helios, imports employees/customers/deals/projects/contracts/invoices/payments/KPI rows idempotently, and reports per-table results.
- [x] Run governance rules after import and verify the proactive operating digest is generated from imported data.
- [x] Add a read-only competition verification command for imported signals and the proactive digest.
- [x] Document required env vars and the safe dry-run/apply/verify workflow.

### Verification Notes
- `node --test scripts/__tests__/operating-loop-feishu-pack.test.mjs scripts/__tests__/operating-loop-feishu-import.test.mjs` passed.
- Feishu online dry-run against the authorized copied spreadsheet passed for `REG-A`: 10 organizations, 36 employees, 91 customers, 270 opportunities, 540 followups, 108 projects, 324 milestones, 17 risks, 108 contracts, 648 revenue lines, 1944 cost lines, 216 invoices, 214 payments, 214 allocations, and 4 scoped KPI targets.
- Dry-run validation returned 0 errors and 0 mapping warnings after adding source enum mappings for closed projects, frozen customers, contract status/type variants, yearly KPI periods, and project gross-profit/gross-margin names.
- The dry-run identified the expected real demo signals: duplicate BMW customer rows (`CUST-0001` and `CUST-0999`), high milestone-delay risks (`RSK-0003`, `RSK-0006`, `RSK-0010`, `RSK-0015`), and overdue-candidate invoices such as `INV-00001` and `INV-00002`.
- API-backed `--apply` writes through Helios HTTP routes and completed successfully against local `http://localhost:3000` with 0 failed operations after idempotency fixes. Final rerun reused 36 employees, 91 customers, 270 opportunities, 540 followups, 108 projects, 324 milestones, 17 risks, 108 contracts, 648 revenue lines, 1944 cost lines, 216 invoices, 214 payments, and 213 allocations, and updated 4 KPI targets by natural key.
- Source allocation `IPR-00030` is structurally inconsistent: its running allocation `77295000.00` exceeds invoice `INV-00032` amount `64412500.00`. The importer reports it as a source-data conflict and skips it instead of mutating the amount or hiding the issue.
- KPI completion now respects the target's own month/quarter/year period and excludes commercial facts after `asOf`, so annual REG-A targets are visible in the August operating digest without changing source data.
- `yarn operating-loop:feishu:verify -- --as-of=2026-08-12` passed against the local Acme Corp organization:
  - Governance rules updated 48 findings.
  - Digest metrics: 7 critical findings, 6 delayed projects, 29 overdue invoices, `427903300.00` CNY overdue outstanding, and 3 KPI gaps.
  - Digest groups were healthy: 7 critical findings, 1 overdue invoice detail, 4 delayed project details, and 3 KPI gap details.
  - The proactive notification linked to `/backend/insights/operating-loop/today`.
- Focused script verification passed 16 tests; focused insights completion/digest tests passed 14 tests.

## Phase 15: Feishu Competition Subject Alignment

### Goal
Make the running demo environment visibly align with the Feishu competition company subject and promote the written Feishu requirements into explicit verification artifacts. The system should fail verification when the selected Helios organization still shows generic demo branding.

### Task List
- [x] Add an API-backed branding command that renames the current Helios organization through `/api/directory/organizations`.
- [x] Add a verifier assertion that the running organization name is `北京四维图新科技股份有限公司`.
- [x] Document the Feishu package requirement coverage matrix, including covered rules and known deterministic gaps.

### Verification Gate
- `node --test scripts/__tests__/operating-loop-feishu-import.test.mjs scripts/__tests__/operating-loop-feishu-verifier.test.mjs`
- `yarn operating-loop:feishu:brand`
- `yarn operating-loop:feishu:verify -- --as-of=2026-08-12`

## Phase 16: WMS Chinese Surface Cleanup

### Goal
Remove high-visibility English copy from the WMS inventory console in Chinese default mode while preserving English locale behavior and technical identifiers such as SKU.

### Task List
- [x] Localize inventory console title, description, operation buttons, scope selectors, balance table headers, search placeholder, and empty state.
- [x] Localize WMS left-nav labels for inventory, warehouses, zones, locations, lots, movements, and reservations.
- [x] Localize reservation and movement section labels that become visible when scrolling the same inventory console.
- [x] Browser-verify `/backend/wms/inventory` shows Chinese labels and no targeted English residues.
- [x] Rewrite full WMS `zh.json` to clear remaining English identical strings and corrupted bilingual fragments across config, dashboard, import, receive/adjust/move, lot/SKU detail, and sales stock widgets.

### Verification Notes
- `yarn i18n:check` passed with no new advisory issues above baseline after intentional baseline refresh.
- Playwright DOM verification passed for `/backend/wms/inventory`; targeted English residues were empty and the expected Chinese labels/placeholders were present.
- Full-module zh rewrite kept intentional technical identicals only (SKU/UOM/FEFO/FIFO/LIFO/RMA/CSV field names/`—`/`…`).
- Follow-up: Staff module `zh.json` fully rewritten (1160 keys) to clear the same bilingual corruption class; customers calendar weekday abbreviations and a few catalog/workflow labels tightened.

### Verification Gate
- `yarn generate`
- `yarn i18n:check`
- `yarn workspace @helios/core test -- governance operating-loop ai-tools --runInBand`
- `node --test scripts/__tests__/operating-loop-acceptance.test.mjs`
- `yarn operating-loop:feishu:verify -- --as-of=2026-08-12`
- `yarn ai:live-eval` when real provider/app env is present
- Focused Playwright tests for digest/page-context UI when UI files change
- `yarn build:packages` or affected package builds before commit

### Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| AI writes unsafe or stale data | High | Keep every write behind pending-action confirmation and stale-version preview where available |
| Batch governance hides partial failures | Medium | Return per-record results and failed ids; never present mixed outcome as full success |
| Prompt regression becomes flaky | Medium | Assert categories/tool calls/markers, not exact prose |
| Context overreach leaks records | High | Pass only visible ids; all tools retain tenant/org filters and feature checks |
| Chinese sweep translates stable codes | Medium | Preserve ids/codes/SKUs/provider names; translate labels, descriptions, demo display values |

## Phase 17: Detailed Module Video Walkthroughs

### Goal
Turn the video recorder from a page sweep into a reusable, detailed product
walkthrough system: every curated module scene should explain the module,
exercise the real page, open the relevant AI assistant, send a Chinese prompt,
and capture the real model/tool output with Chinese and English subtitles.

### Architecture Decisions
- Keep Playwright as the truthful recorder because it can authenticate through
  Helios, select assistants by `agentId`, send prompts into the real chat UI,
  and wait on streamed model output.
- Treat WebReel as an optional finishing tool for polished cursor/key HUD and
  MP4/GIF/WebM rendering, not as the source of mocked AI behavior.
- Store scene narration, feature tour copy, target assistant, and AI prompt in
  `scripts/lib/demo-video-scenes.mjs` so module walkthrough changes are reviewable.
- Generate subtitle cues from the same step model used by the recorder, keeping
  video actions, captions, and manifest evidence aligned.
- Continue recording batches after a scene failure by default, while allowing
  `--fail-fast` for strict CI-style capture.

### Task List
- [x] Add detailed scene metadata for the 15 competition modules.
- [x] Generate multi-step Chinese/English subtitle cues from scene steps.
- [x] Add a recorded on-screen narration overlay for overview, feature tour,
  and AI dialogue stages.
- [x] Automate real AI launcher selection by `agentId` and send scene-specific
  Chinese prompts through the chat composer.
- [x] Add dry-run and preview manifest step details for review before recording.
- [x] Document when to use Playwright versus WebReel for final competition videos.
- [x] Run focused script tests and one local smoke capture.
- [x] Commit and push the detailed walkthrough pipeline.

### Verification Notes
- `node --test scripts/__tests__/demo-video-scenes.test.mjs` passed 7 focused
  scene/caption tests.
- `yarn test:scripts` passed 379 script tests.
- `yarn demo:videos -- --dry-run --scene=02-today-digest --output-dir=.tmp/demo-video-detailed-dry-run`
  wrote a manifest with overview, module-tour, and AI-dialogue steps.
- `yarn demo:videos -- --scene=02-today-digest --duration-ms=4000 --ai-wait-ms=8000 --output-dir=.tmp/demo-video-detailed-ai-smoke`
  produced video, Chinese/English captions, preview HTML, and an `ok` real AI
  dialogue step for `insights.operating_loop_assistant`.

## Phase 18: Platform AI Depth (Cross-Hop + Messages/Staff + Risk Write)

### Goal
Harden verification, force multi-hop Chinese regressions, add read-only messages/staff tools with list entry points, and add confirm-required `projects.manage_risk`. Spec: `.ai/specs/2026-08-19-operating-loop-platform-phase18.md`.

### Task List
- [x] Add Phase 18 spec with explicit out-of-scope dangerous mutations.
- [x] Expand `OPERATING_LOOP_ACCEPTANCE_PROMPTS` with cross-hop, messages, staff, and risk confirm prompts.
- [x] Add `messages.list_messages` / `messages.get_message` and whitelist them.
- [x] Add `staff.list_team_members` / `staff.list_leave_requests` and whitelist them.
- [x] Mount operating-loop triggers on messages + staff list tables.
- [x] Add `projects.manage_risk` confirm-required write.
- [x] Run `yarn generate`, focused tests, acceptance scripts, and feishu verify (`ok` on 2026-08-12).
- [x] `yarn ai:live-eval` Phase 18 prompts green (`zh_cross_hop_customer_to_governance`, `zh_messages_inbox`, `zh_staff_roster`, `zh_risk_confirm_write`) plus `zh_project_loop`; live-eval default timeout raised to 240s with per-prompt tool budget, `LIVE_AI_ACCEPTANCE_PROMPT_IDS`, and `LIVE_AI_ACCEPTANCE_CONTINUE_ON_FAIL`. Full suite initially 17/23; remaining 6 flaky prompts retuned and individually green (including `zh_bulk_governance_disposition`).

## Deployment Checklist (external demo / PoC)

### Pre-flight
- [x] Merge `origin/main` into `feat/operating-loop-platform-coverage` (README conflict resolved).
- [x] `yarn build:app` green (includes WMS ai-tools typing fix).
- [ ] Rotate any API keys that were pasted into chat or logs.
- [ ] Set production secrets only via host env — never commit `.env`.

### Required production env (minimum)
- `APP_URL` — public HTTPS origin
- `DATABASE_URL` — PostgreSQL 17 + pgvector
- `REDIS_URL` — events/queue/cache
- `JWT_SECRET` / `AUTH_SECRET` — strong random values
- `DEMO_MODE=false` — disable demo shortcuts
- Do **not** set `HELIOS_AUTOLOGIN_*` in production

### AI (OpenAI-compatible gateway; no OpenCode/MCP required)
- `HELIOS_AI_PROVIDER=openai`
- `HELIOS_AI_MODEL=deepseek-v4-flash` (or operator-chosen model id)
- `HELIOS_AI_BASE_URL=https://ai.rjk66.cn/v1`
- `OPENAI_API_KEY` — gateway key (inject via platform secret store)
- `OPENAI_BASE_URL=https://ai.rjk66.cn/v1`
- `HELIOS_AI_OPENAI_RESPONSES_STORE=false`

### Deploy paths
1. **Docker full stack (VPS / 内网)** — copy `.env.production.example` → repo-root `.env`, fill secrets, then `./scripts/deploy-docker-poc.sh` (wraps `docker compose -f docker-compose.fullapp.yml up --build -d` + health wait).
2. **Railway** — copy `apps/helios/.env.example` → `apps/helios/.env.production`, fill secrets, `export RAILWAY_API_TOKEN=...`, then `./scripts/deploy-railway-poc.sh` (dry-run) and `yarn helios deploy railway --env-file apps/helios/.env.production --source git`.
3. **Feature branch direct** — deploy `main` after PR #4 merge (done: `f70638cba`).

### Post-deploy smoke
- Login → `/backend/insights/operating-loop/today`
- Ask operating-loop assistant a Chinese multi-hop prompt (延期 + 回款 + KPI + 治理)
- Confirm writes show approval card, not silent persistence
- Optional: `yarn operating-loop:feishu:verify -- --as-of=2026-08-12` against imported org
