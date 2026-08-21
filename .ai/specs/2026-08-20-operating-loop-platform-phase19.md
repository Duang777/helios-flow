# Operating Loop Platform Phase 19

| Field | Value |
|-------|-------|
| Status | implemented |
| Date | 2026-08-20 |
| Extends | `.ai/specs/2026-08-19-operating-loop-platform-phase18.md` |

## TLDR

Keep one orchestrator `insights.operating_loop_assistant` with `confirm-required` writes. Align today-digest critical findings with open+critical list semantics (drop exact `asOf` filter). Add confirm-required WMS receive/adjust/move, workflow start/cancel/retry, and staff leave accept/reject. Do not open unattended writes, credential access, or Cmd+L/Cmd+K unification.

## Goals

1. **Critical consistency** — today digest critical count/group matches governance open+critical findings for the org.
2. **WMS mutations** — `wms.receive_inventory` / `wms.adjust_inventory` / `wms.move_inventory` via existing POST APIs.
3. **Workflow instance control** — `workflows.start_instance` / `workflows.cancel_instance` / `workflows.retry_instance`.
4. **Staff leave decisions** — `staff.accept_leave_request` / `staff.reject_leave_request`.
5. **Verification docs** — acceptance prompts + manual checklist updated for the new confirm paths.

## Out of scope

- Autonomous writes / digest auto-chat
- Integration credential read/write and health POST
- Workflow definition edits / arbitrary advance
- Catalog merchandising bulk mutations
- Auth / api_keys
- OpenCode Code Mode unification

## Closed loop (updated)

```text
客户/商机 → 报价/订单 → 收件箱提案 → 站内消息(read)
  → 商品查阅 → 库存(read + confirm receive/adjust/move)
  → 工作流(read + claim/complete/start/cancel/retry)
  → 员工/请假(read + confirm accept/reject)
  → 项目/里程碑/风险 → 合同结算 → KPI → 治理 → 集成健康(read)
  → 人审确认后写入
```

## Acceptance

- Focused unit tests for new tools + agent whitelist
- `operatingLoopToday` / digest critical asOf removal covered
- `node --test scripts/__tests__/operating-loop-acceptance.test.mjs`
- `mutationPolicy` remains `confirm-required`
- `yarn generate` after tool pack changes
