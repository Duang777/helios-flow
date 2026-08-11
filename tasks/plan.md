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

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Live model behavior is nondeterministic | High | Assert stable observable contracts: tool categories, numbers, formula text, href/evidence markers |
| Seed pollutes normal environments | Medium | Keep it explicit and idempotent; do not hook into `seed:defaults` |
| Page-context widget overexposes data | High | Pass only scoped IDs already visible on the page; runtime/tool ACL still gates reads |
| Injection registry gets stale | Medium | Run `yarn generate` and add tests around context derivation |
