# Implementation Plan: AI Playground Tool Inventory

## Overview
Add a first-class tools inventory surface to the AI playground so admins can inspect every registered AI tool, compare it with the selected agent's whitelist, and demo the module tool graph without leaving the page.

## Architecture Decisions
- Keep the new inventory read-only and admin-scoped through `GET /api/ai_assistant/ai/tools`.
- Reuse existing AI registry loading and permission checks instead of duplicating tool discovery logic in the client.
- Present tool kinds with semantic status primitives so the UI stays aligned with the design system.

## Task List

### Phase 1: Contract
- [ ] Add/verify the tools inventory API response shape and permission gate.
- [ ] Cover the route with unit tests, including bulk and conditional destructive tool metadata.

### Phase 2: Playground UI
- [ ] Add a `Tools` tab to the playground that lists registered tools and highlights the selected agent's whitelist.
- [ ] Replace hardcoded status colors with semantic badge/status primitives.

### Phase 3: Verification
- [ ] Extend the playground Playwright smoke test to cover the new tools tab.
- [ ] Update the playground docs with the new admin demo flow.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Tool inventory gets out of sync with registry loading | Medium | Reuse the same loader path as the agent list route |
| UI styling drifts from DS norms | Medium | Use status badge/badge primitives only |
| Demo flow becomes hard to explain | Low | Document the tab in the playground guide |

