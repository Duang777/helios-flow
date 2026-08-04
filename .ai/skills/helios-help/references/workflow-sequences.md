# Workflow Sequences

> Common development workflows in Helios with the recommended skill sequence.  
> Load this file when the user asks "where do I start?" or "what's the order for X?".

## Table of Contents

- [New Feature](#1-new-feature)
- [Bug Fix](#2-bug-fix)
- [UI / Design System Change](#3-ui--design-system-change)
- [New Module](#4-new-module)
- [PR Lifecycle](#5-pr-lifecycle)
- [Security Audit](#6-security-audit)
- [MikroORM Migration](#7-mikro-orm-migration)
- [New Integration Provider](#8-new-integration-provider)
- [New Skill](#9-new-skill)
- [AI Agent / MCP Tool](#10-ai-agent--mcp-tool)
- [Spec Fix / Rename](#11-spec-fix--rename)
- [Choosing the Right Sequence](#choosing-the-right-sequence)

---

## 1. New Feature

**Use when:** Adding meaningful new functionality (3+ files, or architectural decision).

```
helios-spec-writing
  → helios-pre-implement-spec
  → helios-implement-spec
  → helios-integration-tests
  → helios-smart-test          (run in parallel / as needed)
  → helios-code-review
  → helios-check-and-commit
  → helios-auto-create-pr
```

**Rationale per step:**
1. `helios-spec-writing` — design before coding; gates on open questions
2. `helios-pre-implement-spec` — BC audit + gap analysis before touching code
3. `helios-implement-spec` — phase-by-phase implementation with subagents
4. `helios-integration-tests` — Playwright tests for new API/UI paths
5. `helios-smart-test` — fast unit test loop after each commit
6. `helios-code-review` — architecture, security, DS compliance gate
7. `helios-check-and-commit` — CI-style checks + commit + push
8. `helios-auto-create-pr` — open PR with correct labels

---

## 2. Bug Fix

**Use when:** Fixing a reported bug with a known symptom.

```
helios-root-cause
  → helios-fix
  → helios-smart-test
  → helios-check-and-commit
  → helios-auto-create-pr
```

**Rationale per step:**
1. `helios-root-cause` — structured root-cause analysis before touching code
2. `helios-fix` — minimal targeted fix
3. `helios-smart-test` — run only affected tests
4. `helios-check-and-commit` — verify CI gates pass
5. `helios-auto-create-pr` — ship

> For simple 1-line fixes with obvious root cause, skip `helios-root-cause` and go directly to `helios-fix`.

---

## 3. UI / Design System Change

**Use when:** Adding or modifying backend pages, forms, data tables, or migrating hardcoded DS tokens.

```
helios-ds-guardian            (audit existing violations in touched files)
  → helios-backend-ui-design  (design the layout/components before coding)
  → helios-implement-spec     (or manual implementation for small changes)
  → helios-code-review
  → helios-check-and-commit
  → helios-auto-create-pr
```

**Rationale per step:**
1. `helios-ds-guardian` — catch and fix DS violations in files you're about to touch (Boy Scout Rule)
2. `helios-backend-ui-design` — design consistent UI before implementing
3. `helios-implement-spec` — execute (skip if change is small and self-contained)
4. `helios-code-review` — DS and architecture gate
5. `helios-check-and-commit` + `helios-auto-create-pr` — ship

---

## 4. New Module

**Use when:** Scaffolding a brand-new module from scratch.

```
helios-spec-writing
  → helios-pre-implement-spec
  → helios-implement-spec
  → helios-create-agents-md   (after module structure is stable)
  → helios-integration-tests
  → helios-code-review
  → helios-check-and-commit
  → helios-auto-create-pr
```

**Rationale per step:**
1. `helios-spec-writing` — design entities, events, API contracts, ACL features
2. `helios-pre-implement-spec` — BC + compliance audit
3. `helios-implement-spec` — scaffold module files, commands, routes
4. `helios-create-agents-md` — write AGENTS.md after the module shape is known
5. `helios-integration-tests` — test the new module's API paths
6. `helios-code-review` → `helios-check-and-commit` → `helios-auto-create-pr`

---

## 5. PR Lifecycle

**Use when:** Managing a PR from open to merged.

```
helios-auto-create-pr          (or helios-open-pr for manual branch)
  → helios-auto-review-pr
  → helios-merge-buddy
  → helios-close-fixed-issues
  → helios-auto-update-changelog
```

**Rationale per step:**
1. `helios-auto-create-pr` — create PR with plan, labels, progress checklist
2. `helios-auto-review-pr` — automated review; approve or request changes
3. `helios-merge-buddy` — classify merge-readiness, surface blockers
4. `helios-close-fixed-issues` — close linked GitHub issues
5. `helios-auto-update-changelog` — draft CHANGELOG entry at release time

> For review-only (no automation): use `helios-auto-review-pr <PR-number>` directly.

---

## 6. Security Audit

**Use when:** Auditing a window of merged PRs or a specific spec/branch for security issues.

```
helios-auto-sec-report         (window of PRs)
  → helios-auto-sec-report-pr  (drill into individual PR findings)
```

Or for a single target:
```
helios-auto-sec-report-pr      (single PR / spec / branch diff)
```

---

## 7. MikroORM Migration

**Use when:** Upgrading a module from MikroORM v6 to v7.

```
helios-migrate-mikro-orm
  → helios-smart-test
  → helios-code-review
  → helios-check-and-commit
  → helios-auto-create-pr
```

**Rationale:** `helios-migrate-mikro-orm` handles decorator imports, `persistAndFlush`, Knex→Kysely, and type fixes. Follow with tests and review before shipping.

---

## 8. New Integration Provider

**Use when:** Building a new payment, shipping, or data-sync provider package.

```
helios-spec-writing            (design adapter, credentials, health check)
  → helios-integration-builder (scaffold provider package)
  → helios-implement-spec      (fill in provider logic)
  → helios-integration-tests
  → helios-code-review
  → helios-check-and-commit
  → helios-auto-create-pr
```

---

## 9. New Skill

**Use when:** Creating a new `helios-*` skill.

```
helios-skill-creator
```

`helios-skill-creator` is self-contained — it guides the entire process (understand → plan → init → edit → package → iterate).

After creating the skill, register it in `tiers.json` and update `README.md` manually or via `helios-check-and-commit`.

---

## 10. AI Agent / MCP Tool

**Use when:** Adding `ai-agents.ts` or `ai-tools.ts` to a module.

```
helios-spec-writing            (define agent purpose, tool allowlist, mutation policy)
  → helios-create-ai-agent     (scaffold agent/tool files)
  → helios-implement-spec      (fill in tool handlers)
  → helios-smart-test
  → helios-code-review
  → helios-check-and-commit
  → helios-auto-create-pr
```

---

## 11. Spec Fix / Rename

**Use when:** Normalizing legacy `SPEC-*` filenames or fixing broken spec links.

```
helios-fix-specs
  → helios-check-and-commit
  → helios-auto-create-pr
```

---

## Choosing the Right Sequence

| Situation | Sequence to use |
|-----------|-----------------|
| I know what to build but haven't started | [New Feature](#1-new-feature) or [New Module](#4-new-module) |
| Bug is reported with logs/error message | [Bug Fix](#2-bug-fix) |
| I need to change a page or form | [UI / Design System Change](#3-ui--design-system-change) |
| I need to open or manage a PR | [PR Lifecycle](#5-pr-lifecycle) |
| Security review requested | [Security Audit](#6-security-audit) |
| MikroORM errors after upgrade | [MikroORM Migration](#7-mikro-orm-migration) |
| Adding Stripe / DHL / etc. | [New Integration Provider](#8-new-integration-provider) |
| I want to add a Claude tool/agent | [AI Agent / MCP Tool](#10-ai-agent--mcp-tool) |
| I want to create a new skill | [New Skill](#9-new-skill) |
| Spec filenames are messy | [Spec Fix / Rename](#11-spec-fix--rename) |
| I'm not sure what I need | Start with `helios-spec-writing` for non-trivial work, or ask `helios-help` |
