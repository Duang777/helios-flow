# Checkpoint 3 — Phase 13 "all entities" scope extension

**Steps verified:** 13.1, 13.2, 13.3, 13.4, 13.5
**SHA range:** 8932cd344..284b72b38 (5 commits)
**Packages touched:**

- `@helios/shared` (factory.ts, optimistic-lock.ts, optimistic-lock-store.ts, related tests)
- `@helios/core` (new integration spec `TC-LOCK-OSS-004.spec.ts`)
- `apps/docs` (docs page `concurrency-locking.mdx`)
- `.github/workflows/ci.yml` (`HELIOS_OPTIMISTIC_LOCK=all`)
- `.ai/specs/2026-05-25-oss-optimistic-locking.md` (decision matrix + §3.5.1)
- `.ai/runs/2026-05-25-oss-optimistic-locking/{PLAN,NOTIFY}.md`

## Targeted validation

| Check | Result |
|-------|--------|
| `yarn build:packages` | ✅ 19/19 successful (18 cache hits, 1 rebuild for shared+core) |
| `yarn generate` | ✅ "All generators completed" |
| `yarn i18n:check-sync` | ✅ all 4 locales in sync (47 modules) |
| `yarn i18n:check-usage` | ⚠️ 3650 unused keys (advisory only — matches develop baseline; no new keys introduced by this resume) |
| `yarn workspace @helios/shared typecheck` | ✅ clean |
| `yarn workspace @helios/core typecheck` | ❌ FAILS — `tsconfig.json(7,27): error TS5103: Invalid value for '--ignoreDeprecations'.` Pre-existing on develop too (verified by checking out `origin/develop`'s tsconfig — identical `ignoreDeprecations: "6.0"` value). Not caused by this resume; out of scope for this PR. |
| `yarn workspace @helios/shared test` (full) | ✅ 995 / 995 (93 suites) |
| `yarn workspace @helios/ui test` (full) | ✅ 1067 / 1067 (140 suites) |
| `yarn workspace @helios/core test` (full) | ✅ 4189 / 4189 (498 suites) |

Targeted suite — directly exercises the optimistic-lock surface
extended in this resume:

| Suite | Result |
|-------|--------|
| `optimistic-lock|crud-factory|mutation-guard` (shared) | ✅ 78 / 78 (4 suites) — includes 10 new `createGenericOptimisticLockReader` tests, 5 new `registerOptimisticLockReaderIfAbsent` tests, 4 new factory auto-registration tests |
| `optimistic|mutation-guard|guards|customers/di|sales/di` (core) | ✅ 33 / 33 (2 suites) — confirms `customers/data/guards.ts` and the hand-wired readers in `customers/di.ts` / `sales/di.ts` still pass alongside the new factory hook |
| `optimisticLock|CrudForm|useGuardedMutation` (ui) | ✅ 66 / 66 (13 suites) — header injection, conflict surfacing, and `<CrudForm>` integration all green |

## UI verification

**Skipped — no UI files were touched in this resume window.** The
Phase 13 changes are server-side only (factory.ts hook,
optimistic-lock.ts factory, store helper, docs/spec text, new
integration spec, CI env). The 5 commits do not modify any `.tsx`,
backend page, portal page, widget, or component. UI smoke covers
nothing new.

The existing UI surface (`CrudForm.optimisticLock`,
`useGuardedMutation.optimisticLock`, `companies-v2/[id]/page.tsx`)
shipped in Phases 9–11 and was already exercised by Playwright in CI.

## Decisions / problems

- **TypeScript 6.0.3 vs `ignoreDeprecations: "6.0"` value** — TS 6.0
  removed support for the `ignoreDeprecations` compiler option (all
  the legacy options it suppressed warnings for were removed in 6.0).
  The codebase still passes the value in every tsconfig, so
  `yarn typecheck` fails at the very first option-parse step. This
  is **pre-existing on develop** — confirmed by checking out
  `origin/develop`'s `packages/core/tsconfig.json` and seeing the
  identical line. **Out of scope** for PR #2055. A separate fix
  should remove the option (or downgrade TypeScript) on develop.
- The legacy in-tree `Progress` section under PLAN.md still references
  Phases 1–6 only. Tasks-table rows 13.1–13.5 are the source of truth
  per the `auto-continue-pr-loop` contract; the legacy section is
  kept verbatim for historical context only and is not updated.

## Next

Step 6 of `auto-continue-pr-loop` (BC + self code-review) and step 7
(`auto-review-pr` autofix pass) follow. After those land:
- Step 5 final gate (`yarn test:integration` + standalone) — already
  preempted by `HELIOS_OPTIMISTIC_LOCK=all` flipping CI to exercise the
  generic path on every shard.
- ds-guardian: nothing in this resume touches UI tokens or styles, so
  the pass should be trivially clean. Will re-confirm.
- Summary comment + PR body update + lock release.
