# Operating Loop Platform Phase 21

| Field | Value |
|-------|-------|
| Status | implemented |
| Date | 2026-08-21 |
| Extends | `.ai/specs/2026-08-21-operating-loop-platform-phase20.md` |

## TLDR

Mount Operating Loop Assistant on **message detail** and **leave-request detail** headers (same confirm-required agent). Keep mutationPolicy confirm-required. No LIVE_AI dependency for CI gates.

## Goals

1. `detail:messages.message:header` + `detail:staff.leave_request:header` injection spots wired to `insights.injection.operating-loop-trigger`.
2. Page-context maps detail entity types / leaveRequestId / messageId correctly.
3. Unit coverage that message write tools expose `isMutation` + `loadBeforeRecord` (confirm metadata without LLM).

## Out of scope

- LIVE_AI gateway smoke (optional when `ai.rjk66.cn` recovers)
- Message email / attachments
- Unattended writes

## Acceptance

- Unit: page-context detail cases for messages + leave; messages tools have `loadBeforeRecord`
- Injection table lists both detail spots
- `yarn generate` if registries change

## Changelog

- 2026-08-21: Implemented detail header injections + confirm metadata unit tests; page-context field resolver updated.
