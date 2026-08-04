# Auto Verify And Fix GitHub Skill

## TLDR

Add `helios-auto-verify-and-fix-github`, a sibling of `helios-auto-fix-github` for browser-visible GitHub issues. The new skill must claim the issue, create an isolated worktree, boot or reuse an ephemeral integration environment, reproduce the bug through the browser before editing, encode the reproduced flow as a Playwright integration test, fix the bug, make the new test green, run the normal validation and review gates, then open a PR against `develop`.

## Overview

`helios-auto-fix-github` already covers issue locking, solved-work checks, isolated worktrees, minimal fixes, regression tests, validation, labels, and issue handoff. Browser-visible bugs need one stronger workflow: prove the problem in the running app before changing code, and preserve that proof as an executable browser integration test.

This spec introduces only agent workflow documentation. It does not add runtime code, application APIs, data models, or package dependencies.

## Problem Statement

Current issue-fix automation can anchor a bug with unit tests or targeted commands. For UI regressions, that leaves too much room for guessed selectors, non-representative fixtures, and fixes that pass unit tests but fail in the actual browser flow.

The desired behavior is:

- start from a clean ephemeral app environment,
- reproduce the reported issue with Browser/Playwright exploration,
- record a failing Playwright integration test from the observed flow,
- apply the minimal product fix,
- make the browser test pass before opening a PR.

## Proposed Solution

Create `.ai/skills/helios-auto-verify-and-fix-github/SKILL.md` with a workflow that reuses the `helios-auto-fix-github` lock, worktree, validation, label, and PR conventions, and adds mandatory browser verification phases from `helios-integration-tests`.

Key requirements:

- Always use the GitHub issue claim protocol before mutating labels, assignees, or code.
- Always use an isolated worktree based on `origin/develop`.
- Always start or reuse the worktree-local `.ai/qa/ephemeral-env.json` environment before browser exploration.
- Always reproduce through the browser before editing production code.
- Always write the Playwright integration test before the fix when the issue is browser-reproducible.
- Always run the new test red before the fix and green after the fix, unless the red run is blocked by an environment failure that is documented in the PR.
- Always keep the PR body explicit about browser reproduction evidence and the new integration test.

## Architecture

No application architecture changes.

Skill composition:

- Base issue workflow: `.ai/skills/helios-auto-fix-github/SKILL.md`
- Browser/integration workflow: `.ai/skills/helios-integration-tests/SKILL.md`
- Review gate: `.ai/skills/helios-code-review/SKILL.md`
- Compatibility gate: `BACKWARD_COMPATIBILITY.md`

The new skill intentionally duplicates the full operational sequence rather than requiring agents to mentally merge two skills at runtime. This keeps issue handling auditable and reduces skipped verification steps.

## Data Models

No data model changes.

## API Contracts

No API contract changes.

## Integration Coverage

This change is itself an agent workflow. It requires documentation-level validation:

- confirm the new skill has valid frontmatter with `name` and `description`,
- confirm the skill index includes the new skill,
- confirm the workflow names the ephemeral integration commands and module-local Playwright test locations.

The new skill requires future runs to create module-local Playwright tests for the issue being fixed.

## Implementation Plan

1. Add this spec under `.ai/specs/`.
2. Add `.ai/skills/helios-auto-verify-and-fix-github/SKILL.md`.
3. Update `.ai/skills/README.md` automation table.
4. Validate the diff with targeted text checks and `git diff --check`.
5. Commit, push, and open a PR against `develop`.

## Risks & Impact Review

| Risk | Severity | Mitigation |
|------|----------|------------|
| Agents skip the browser reproduction step and fall back to unit-only fixes | High | Make browser reproduction and red/green Playwright evidence hard requirements in the new skill rules. |
| Ephemeral environment from another checkout is reused accidentally | Medium | Require the skill to run all app startup and testing inside the isolated worktree and to verify `.ai/qa/ephemeral-env.json` before use. |
| Browser tests become brittle | Medium | Reuse `helios-integration-tests` locator and fixture rules: discover selectors from snapshots, create fixtures at runtime, clean up in teardown, avoid seeded data. |
| New automation overlaps with `helios-auto-fix-github` | Low | Position this as the browser-first variant; use `helios-auto-fix-github` for non-browser/static issues. |

## Final Compliance Report

- Contract surfaces: no runtime contracts changed.
- Tenant isolation: not applicable.
- Data security: not applicable.
- Backward compatibility: additive skill-only change.
- Design system: not applicable.
- Testing: documentation validation only; future runs must generate and pass Playwright tests for the fixed issue.

## Changelog

- 2026-06-06: Added spec for `helios-auto-verify-and-fix-github`.
