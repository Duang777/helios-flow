# Operating Loop Platform Phase 20

| Field | Value |
|-------|-------|
| Status | implemented |
| Date | 2026-08-21 |
| Extends | `.ai/specs/2026-08-20-operating-loop-platform-phase19.md` |

## TLDR

**Key Points:**
- Keep one orchestrator `insights.operating_loop_assistant` with **confirm-required** writes only.
- Slice A: disposable fixtures + Playwright so leave / claimable-task confirm paths are testable without demo seed.
- Slice B: close the messages hop with confirm-required `send` / `reply` (in-app only, never `sendViaEmail`).

**Decisions (locked):**
- Q1 = `(c)` both slices, sequential (A then B)
- Q2 = `(b)` messages send/reply
- Q3 = `(a)` auto-create disposable workflow definition+instance in tests
- Q4 = `(a)` mutationPolicy stays confirm-required everywhere (no unattended)

## Goals

1. **Fixture-backed verification** — create/delete leave + claimable user-task fixtures in Playwright; leave list mounts operating-loop trigger; workflow tasks page mounts trigger when a claimable task exists.
2. **Messages confirm writes** — `messages.send_message` / `messages.reply_to_message` via existing compose/reply APIs; always `sendViaEmail=false`.
3. **Agent whitelist + prompts** — operating-loop agent can call the new tools; acceptance prompts + checklist updated.
4. **Safety** — no digest auto-chat, no credentials, no Cmd+L/Cmd+K merge, no catalog bulk merchandising.

## Out of scope

- Autonomous writes / digest auto-chat
- Message email delivery (`sendViaEmail`) and attachment mutation tools
- Integration credential read/write
- Workflow definition editing from the advisor
- Catalog merchandising bulk mutations
- OpenCode Code Mode unification

## Closed loop (updated)

```text
客户/商机 → 报价/订单 → 收件箱提案 → 站内消息(read + confirm send/reply)
  → 商品查阅 → 库存(read + confirm receive/adjust/move)
  → 工作流(read + claim/complete/start/cancel/retry) [tests self-seed claimable tasks]
  → 员工/请假(read + confirm accept/reject) [tests self-seed leave]
  → 项目/里程碑/风险 → 合同结算 → KPI → 治理 → 集成健康(read)
  → 人审确认后写入
```

## Architecture

- Reuse `defineAiTool` + `createAiApiOperationRunner` + `loadBeforeRecord` (same pattern as staff leave / WMS writes).
- Messages compose: `POST /api/messages` with `messages.compose`; reply: `POST /api/messages/:id/reply`.
- Playwright reuses `createStaffTeamMemberFixture`, leave CRUD APIs, and `buildClaimableUserTaskDefinitionPayload` / start-instance helpers.
- Live LLM confirm-card smoke remains optional (`LIVE_AI`); CI acceptance is fixtures + tool `isMutation` + whitelist + prompts.

## Implementation Phases

### Phase 20A — Confirm fixtures + Playwright
1. Extend operating-widget integration coverage: leave list trigger with created leave; claimable workflow fixture → `/backend/tasks` trigger.
2. Document skip/optional LIVE_AI leave-accept confirm in checklist notes.
3. Acceptance prompt already covers leave; add claim fixture note if needed.

### Phase 20B — Messages confirm writes
1. Add `messages.send_message` / `messages.reply_to_message` (`isMutation`, `loadBeforeRecord`, force no email).
2. Whitelist on `insights.operating_loop_assistant`; update system prompt routing.
3. Unit + agent whitelist tests; acceptance prompt; checklist T13 update; `yarn generate`.

## Acceptance

- Unit: messages mutation tools exported with `isMutation`; agent whitelist includes both; write-tools gate still holds.
- Playwright: leave + claimable-task fixtures create/clean; operating-loop triggers visible on those list pages.
- `node --test scripts/__tests__/operating-loop-acceptance.test.mjs`
- `mutationPolicy` remains `confirm-required`
- `yarn generate` after tool registration changes

## Risks

| Risk | Mitigation |
|------|------------|
| Gateway down blocks live LLM smoke | CI does not require LIVE_AI; fixtures + mutation metadata are the gate |
| Email send needs RESEND | Tools hard-force `sendViaEmail=false` |
| Workflow claimable role mismatch | Use existing `buildClaimableUserTaskDefinitionPayload` (`assignedTo: ['admin']`) |

## Changelog

- 2026-08-21: Skeleton → decisions locked; Phase 20A/20B scoped.
- 2026-08-21: Implemented messages.send_message / reply_to_message; whitelist + prompts + checklist T13; leave/claimable-task Playwright fixtures in TC-INS-OPERATING-WIDGET-001; unit + acceptance green.
