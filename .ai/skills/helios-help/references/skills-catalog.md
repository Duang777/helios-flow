# Skills Catalog

> All `helios-*` skills organized by tier. Load this file when answering "what skill should I use?" or "what comes next?".
>
> Note: many pipeline skills (code review, auto-create/review PR, merge buddy, spec writing, changelog, …) are installed from the shared [helios/skills](https://github.com/helios/skills) collection into `.agents/skills/` by `yarn install-skills` — see the `external` block in `.ai/skills/tiers.json`. Skill names below stay valid regardless of source; the external collection also adds `helios-auto-fix-issue`, `helios-setup-agent-pipeline`, and `helios-auto-fix-pr` (CI stabilization via `--ci-only`).

## Table of Contents

- [core](#core)
- [automation](#automation)
- [security](#security)
- [migration](#migration)
- [infra](#infra)

---

## core

Default tier — installed by `yarn install-skills`.

| Skill | Trigger phrase / When to use | Preceded by | Followed by |
|-------|------------------------------|-------------|-------------|
| `helios-help` | "what now?", "next steps?", "which skill?", "how do I X in OM?", orientation questions | — | any |
| `helios-spec-writing` | New feature (3+ files), architectural change, new module | — | `helios-pre-implement-spec` |
| `helios-pre-implement-spec` | Before implementing a spec — BC audit, gap analysis, readiness report | `helios-spec-writing` | `helios-implement-spec` |
| `helios-implement-spec` | Execute an existing spec phase by phase | `helios-pre-implement-spec` | `helios-code-review` |
| `helios-code-review` | Review before merge — architecture, security, DS, conventions | `helios-implement-spec` | `helios-check-and-commit` |
| `helios-check-and-commit` | Run CI-style checks (build, typecheck, i18n, tests) then commit + push | `helios-code-review` | `helios-auto-create-pr` |
| `helios-smart-test` | "run affected tests", "test only what changed", fast test loop | any stage | — |
| `helios-ds-guardian` | UI/design system change — migrate hardcoded colors, enforce DS tokens | — | `helios-code-review` |
| `helios-backend-ui-design` | Design admin pages, CRUD forms, data tables before implementing | — | `helios-implement-spec` |
| `helios-integration-tests` | Create or run Playwright integration tests after implementation | `helios-implement-spec` | `helios-code-review` |
| `helios-fix-specs` | Normalize legacy `SPEC-*` filenames to date+slug convention | — | `helios-implement-spec` |
| `helios-create-agents-md` | Create or rewrite AGENTS.md for a new package or module | `helios-implement-spec` | — |
| `helios-skill-creator` | Create a new skill or update an existing one | — | — |
| `helios-create-ai-agent` | Add AI agents (`ai-agents.ts`) or MCP tools (`ai-tools.ts`) to a module | `helios-spec-writing` | `helios-implement-spec` |
| `helios-migrate-mikro-orm` | Migrate module code from MikroORM v6 → v7 (decorators, Knex→Kysely) | — | `helios-smart-test` |

---

## automation

Opt-in: `yarn install-skills --with automation`

| Skill | Trigger phrase / When to use | Preceded by | Followed by |
|-------|------------------------------|-------------|-------------|
| `helios-auto-create-pr` | "ship this as a PR", run task end-to-end and open a GitHub PR | `helios-check-and-commit` | `helios-auto-review-pr` |
| `helios-auto-continue-pr` | Resume an in-progress PR started by `helios-auto-create-pr` | — | `helios-auto-review-pr` |
| `helios-auto-create-pr-loop` | Long multi-step spec implementation with step-level resumability | — | `helios-auto-review-pr` |
| `helios-auto-continue-pr-loop` | Resume a PR started by `helios-auto-create-pr-loop` | — | `helios-auto-review-pr` |
| `helios-auto-review-pr` | Automated PR review — runs `helios-code-review`, sets labels | `helios-auto-create-pr` | `helios-merge-buddy` |
| `helios-auto-fix-issue` | Fix a GitHub issue by number end-to-end | — | `helios-auto-create-pr` |
| `helios-prepare-issue` | Capture a feature to build later — write the spec, ship a docs-only spec PR, open a tracking issue | `helios-spec-writing` | `helios-implement-spec` |
| `helios-verify-in-repo` | Verify a change works in the repo (build + smoke check) | `helios-implement-spec` | — |
| `helios-root-cause` | Analyze root cause of a bug before fixing | — | `helios-fix` |
| `helios-fix` | Fix a bug autonomously after root cause is known | `helios-root-cause` | `helios-smart-test` |
| `helios-open-pr` | Open a GitHub PR from the current branch | `helios-check-and-commit` | `helios-auto-review-pr` |
| `helios-review-prs` | Review all unreviewed open PRs in batch | — | — |
| `helios-merge-buddy` | Classify PRs as merge-ready / close-but-blocked | `helios-auto-review-pr` | `helios-close-fixed-issues` |
| `helios-close-fixed-issues` | Close linked issues after merge, comment on abandoned PRs | `helios-merge-buddy` | `helios-auto-update-changelog` |
| `helios-auto-update-changelog` | Draft CHANGELOG.md release entry for merged PRs | after merge | — |
| `helios-auto-qa-scenarios` | Generate human QA report (P0/P1/P2 routes) for merged PRs | `helios-implement-spec` | — |

---

## security

Opt-in: `yarn install-skills --with security`

| Skill | Trigger phrase / When to use | Preceded by | Followed by |
|-------|------------------------------|-------------|-------------|
| `helios-auto-sec-report` | Security audit over a window of merged PRs or specs | — | `helios-auto-sec-report-pr` |
| `helios-auto-sec-report-pr` | OWASP-focused security analysis for a single PR, spec, or branch | `helios-auto-sec-report` | — |

---

## migration

Opt-in: `yarn install-skills --with migration` — install only when needed.

| Skill | Trigger phrase / When to use | Preceded by | Followed by |
|-------|------------------------------|-------------|-------------|
| `helios-auto-upgrade-0.4.10-to-0.5.0` | Migrate downstream codebase from Helios 0.4.10 → 0.5.0 | — | — |

---

## infra

Opt-in: `yarn install-skills --with infra` — rare / special-case.

| Skill | Trigger phrase / When to use | Preceded by | Followed by |
|-------|------------------------------|-------------|-------------|
| `helios-dev-container-maintenance` | Any change to `.devcontainer/`, container build/start failures | — | — |
| `helios-integration-builder` | Build a new integration provider package (payment, shipping, data-sync) | `helios-spec-writing` | `helios-implement-spec` |

---

## Notes

- **preceded-by / followed-by** are suggestions, not hard constraints. The appropriate next step depends on context.
- Skills with `—` in preceded-by can be entry points for their workflow type.
- `helios-smart-test` is usable at any stage and is not sequenced.
- `helios-help` itself is always the entry point when the developer is disoriented.
