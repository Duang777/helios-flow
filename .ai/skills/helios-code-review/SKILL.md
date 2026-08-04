---
name: helios-code-review
description: Helios repo-local extension of the shared `helios-code-review` skill (installed from helios/skills into .agents/skills/). Adds the Docker-vs-local gate runner detection, the template parity gate, Helios layer classification, and the repo's severity taxonomy on top of the shared workflow.
---

# Code Review — Helios extension

This file extends the shared `helios-code-review` skill from [helios/skills](https://github.com/helios/skills) (installed at `.agents/skills/helios-code-review/SKILL.md`). Follow the shared skill's full workflow — config loading, validation gate, checklists, breaking-change gate, output format — with the repo-specific rules below layered on top. The validation commands come from `.ai/agentic.config.json`; the full repo checklist is `.ai/review-checklist.md` (wired via the config's `reviewChecklist` field).

## Step 0 — Decide where to run the gate (execute ONCE before any gate command)

Before running any `validation.commands` gate, pick the runner (Docker vs local) using the probe order documented in root `AGENTS.md` § Validation Commands — probe candidates with `docker compose -f <file> ps --status running -q app`, honor `DOCKER_COMPOSE_FILE` first, and in Docker mode map each `yarn X` to `node scripts/docker-exec.mjs X`. Record the chosen runner in the review output (e.g. `Runner: docker (docker-compose.fullapp.dev.yml)` or `Runner: local`). Never silently fall through to the production compose profile on a parse error — log and try the next candidate.

The same Step 0 applies wherever the validation gate runs (`helios-check-and-commit`, `helios-auto-create-pr`, `helios-implement-spec`, `helios-smart-test`).

Gate-order note: run `yarn typecheck` and `yarn test` in parallel (they are independent); the second `yarn build:packages` run exists to rebuild with the files `yarn generate` produced.

## Template parity gate

After the validation gate, run `yarn template:sync`. If drift is reported (especially app layout/routes between `apps/helios/src/{app,modules}` and `packages/create-app/template/src/{app,modules}`), ask the user whether to sync now; if approved, run `yarn template:sync:fix` and include the synced files in the change.

## Scope classification (Helios layers)

Classify each changed file by Helios layer: API route, entity, validator, backend page, frontend page, subscriber, worker, command, search config, setup, ACL, events, DI, widget, test. Then read the `AGENTS.md` of each touched module/package — the task-routing table in the root `AGENTS.md` maps layers to the files that govern them.

## Context sources

- `.ai/specs/` — check for active specs on the touched modules; flag divergence from an active spec.
- `.ai/lessons.md` — known pitfalls; treat documented lessons as review rules.
- `BACKWARD_COMPATIBILITY.md` — protected contract surfaces (the shared skill already enforces this; violations are Critical).

## Frontend performance gate

The shared skill's UI Performance Gate applies with these Helios specifics: run `yarn check:client-boundaries` when the diff touches web routes, providers, or the app shell (the "use client" boundary ledger — see the Frontend Architecture Contract at `.ai/skills/helios-spec-writing/references/frontend-architecture-contract.md`); watch for backend pages that turn server components into client components, route entry points that import heavy editors/calendars/graphs eagerly instead of dynamic islands, and global providers importing route-specific SDKs. `helios-ds-guardian` and `helios-backend-ui-design` (local skills) define the DS/UI conventions the diff must follow.

## Severity taxonomy

This repo historically reports findings as **Critical / High / Medium / Low**; the shared skill uses **blocker / major / minor / nit**. They map 1:1 in that order. Use the shared skill's labels in the verdict (callers consume blocker/major) and classify by these repo rules:

| Severity | Criteria | Action |
|----------|----------|--------|
| **Critical** (blocker) | Security vulnerability, cross-tenant data leak, data corruption risk, missing auth guard, **backward compatibility violation** (breaking contract surface without deprecation bridge), failed validation-gate command | MUST fix before merge |
| **High** (major) | Architecture violation, missing required export (`openApi`, `metadata`), broken module contract, **missing deprecation annotation** on contract change | MUST fix before merge |
| **Medium** (minor) | Convention violation, suboptimal pattern, missing best practice | Should fix |
| **Low** (nit) | Style suggestion, minor improvement, readability | Nice to have |
