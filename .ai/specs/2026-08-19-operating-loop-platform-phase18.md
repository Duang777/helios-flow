# Operating Loop Platform Phase 18

| Field | Value |
|-------|-------|
| Status | implemented |
| Date | 2026-08-19 |
| Extends | `.ai/specs/2026-08-19-operating-loop-platform-coverage.md` |

## TLDR

Keep one orchestrator `insights.operating_loop_assistant`. Harden verification, strengthen multi-hop Chinese prompts, add read-only messages/staff tools with list-page entry points, and add one safe confirm-required write: `projects.manage_risk`. Do not open WMS mutations, integration credentials, workflow start/cancel/retry, or unattended writes.

## Goals

1. **Verification gate** — feishu verify + acceptance script green; live-eval when provider env is present.
2. **Cross-hop chaining** — fixed Chinese prompts that require CRM → sales/inbox → project/settlement → KPI/governance in one answer; digest suggest-preview stays confirm-required.
3. **Read-only expansion** — `messages.list_messages` / `messages.get_message`; `staff.list_team_members` / `staff.list_leave_requests`. Tool-level ACL so tenants without those modules still open the advisor.
4. **Safe write** — `projects.manage_risk` (update status/owner/title) with `isMutation` + `loadBeforeRecord`, whitelist on the orchestrator.

## Out of scope

- Autonomous writes / digest auto-chat
- WMS receive / adjust / move
- Integration credential read/write and health POST
- Workflow start / cancel / retry / definition edits
- Auth / api_keys
- Catalog merchandising bulk mutations
- Staff leave accept/reject mutations (read-only this phase)

## Closed loop (updated)

```text
客户/商机 → 报价/订单 → 收件箱提案 → 站内消息(read)
  → 商品/库存(read) → 工作流认领/完成 → 员工/请假(read)
  → 项目/里程碑/风险(含风险确认写入) → 合同结算 → KPI → 治理 → 集成健康(read)
  → 人审确认后写入
```

## Tasks

### 18A Verification
- Run acceptance + feishu script tests; attempt `yarn operating-loop:feishu:verify` and `yarn ai:live-eval` when env allows.

### 18B Cross-hop prompts
- Add multi-hop entries to `OPERATING_LOOP_ACCEPTANCE_PROMPTS`.
- Mention messages/staff/risk tools in operating-loop system prompt routing.

### 18C Messages + staff read tools
- Module `ai-tools.ts` with `defineApiBackedAiTool`, hrefs on every row, empty-list collection href.
- Whitelist on operating-loop agent.
- Inject trigger on `data-table:messages:search-trailing` and staff list tables (add `extensionTableId` where missing).

### 18D `projects.manage_risk`
- Confirm-required update via `PUT /projects/risks`.
- Unit coverage for tool name, `isMutation`, runner body.

## Acceptance

- `yarn generate` after new `ai-tools.ts`
- Focused unit tests for new tools + agent whitelist
- `node --test scripts/__tests__/operating-loop-acceptance.test.mjs`
- Mutation policy remains `confirm-required`
