# Skills Catalog — Standalone App

> All skills available in a `create-helios-app` project, organized by category.  
> Load this file when answering "what skill should I use?" or "what comes next?".

## Table of Contents

- [Building Your App](#building-your-app)
- [Extending & Customizing](#extending--customizing)
- [Troubleshooting & Maintenance](#troubleshooting--maintenance)
- [PR & Code Quality](#pr--code-quality)
- [Migration](#migration)

---

## Building Your App

Skills for creating new functionality in your standalone Helios application.

| Skill | Trigger / When to use | Preceded by | Followed by |
|-------|----------------------|-------------|-------------|
| `helios-help` | "what now?", "which skill?", "next steps?", "how do I X?", orientation | — | any |
| `helios-data-model-design` | Designing entities, relationships, migrations, encryption maps for PII | — | `helios-spec-writing` or `helios-module-scaffold` |
| `helios-spec-writing` | Writing a spec before building a non-trivial feature | `helios-data-model-design` | `helios-module-scaffold` or `helios-implement-spec` |
| `helios-module-scaffold` | Creating a new module with entity, routes, pages, ACL, DI | `helios-spec-writing` or `helios-data-model-design` | `helios-integration-tests` |
| `helios-implement-spec` | Implementing an existing spec phase-by-phase | `helios-spec-writing` | `helios-integration-tests` |
| `helios-backend-ui-design` | Designing admin pages, CRUD forms, data tables | — | `helios-implement-spec` or `helios-module-scaffold` |
| `helios-integration-builder` | Building a payment, shipping, or data-sync integration provider | `helios-spec-writing` | `helios-integration-tests` |
| `helios-integration-tests` | Writing or running Playwright integration tests | `helios-module-scaffold` or `helios-implement-spec` | `helios-code-review` |

---

## Extending & Customizing

Skills for modifying or extending behavior without touching core module source.

| Skill | Trigger / When to use | Preceded by | Followed by |
|-------|----------------------|-------------|-------------|
| `helios-system-extension` | Add columns/fields/filters to existing tables, enrich API responses, intercept routes, inject menu items, replace UI components | — | `helios-code-review` |
| `helios-eject-and-customize` | When UMES extensions aren't enough and you need to modify core module source directly | — | `helios-code-review` |
| `helios-trim-unused-modules` | Slim down the app by disabling modules you don't use | — | `helios-code-review` |

---

## Troubleshooting & Maintenance

| Skill | Trigger / When to use | Preceded by | Followed by |
|-------|----------------------|-------------|-------------|
| `helios-troubleshooter` | Errors, module not loading, widgets not appearing, migration failures, build errors, "it doesn't work" | — | `helios-code-review` (after fix) |

---

## PR & Code Quality

| Skill | Trigger / When to use | Preceded by | Followed by |
|-------|----------------------|-------------|-------------|
| `helios-code-review` | Review before merging — architecture, security, DS, conventions | any impl skill | `helios-auto-create-pr` |
| `helios-auto-create-pr` | Ship work as a GitHub PR end-to-end | `helios-code-review` | `helios-auto-review-pr` |
| `helios-auto-continue-pr` | Resume an in-progress PR started by `helios-auto-create-pr` | — | `helios-auto-review-pr` |
| `helios-auto-create-pr-loop` | Long multi-step implementation with step-level resumability | — | `helios-auto-review-pr` |
| `helios-auto-continue-pr-loop` | Resume a PR started by `helios-auto-create-pr-loop` | — | `helios-auto-review-pr` |
| `helios-auto-review-pr` | Automated PR review + approve/request-changes | `helios-auto-create-pr` | — |
| `helios-auto-fix-issue` | Fix a GitHub issue end-to-end (drives `helios-verify-in-repo` → `helios-root-cause` → `helios-fix` → `helios-open-pr`) | — | `helios-auto-create-pr` |
| `helios-prepare-issue` | Capture a feature to build later — write the spec, ship a docs-only spec PR, open a tracking issue | `helios-spec-writing` | `helios-implement-spec` |
| `helios-prepare-test-env` | Boot a reusable local test environment (shared descriptor for QA + integration tests) | — | `helios-integration-tests` |
| `helios-setup-agent-pipeline` | Tailor `.ai/agentic.config.json` (labels, QA gate, tracker, validation commands) — the scaffold ships working defaults | — | any auto-skill |
| `helios-apply-upgrade-notes` | Sync installed pipeline artifacts after `yarn install-skills` refreshed the external collection | — | — |

---

## Migration

| Skill | Trigger / When to use | Preceded by | Followed by |
|-------|----------------------|-------------|-------------|
| `helios-auto-upgrade-0.4.10-to-0.5.0` | Upgrade app from Helios 0.4.10 → 0.5.0 | — | `helios-code-review` |

---

## Notes

- **preceded-by / followed-by** are suggestions, not hard constraints.
- `helios-troubleshooter` is always a valid entry point when something is broken.
- `helios-system-extension` should be tried before `helios-eject-and-customize` — ejecting makes upgrades harder.
- `helios-help` is always the right starting point when you're unsure.
