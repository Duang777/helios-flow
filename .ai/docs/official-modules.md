# `external/official-modules/` (git submodule)

The long-form version of the official-modules contract. The root `AGENTS.md` keeps the
one-line boundary (treat it as first-class code, never bump the pointer unasked); everything
below is the detail that used to live there.

`external/official-modules/` is a **git submodule** pointing at `helios/official-modules`
(a public repo). When present it is real working code — treat it as first-class for search,
grep, refactoring, and cross-module reasoning, not as vendored/build output.

- It is **optional and not committed** — `.gitmodules` and the `external/official-modules`
  checkout are not part of the helios repo. They're created locally by
  `yarn official-modules add …` (which runs `git submodule add`). A fresh clone has no
  submodule; `yarn install` and CI are unchanged.
- **Activation is driven by `official-modules.json`** (committed; `activated` is the team
  default, `available` is auto-filled once the submodule is present) and
  `official-modules.local.json` (gitignored personal override). Use `yarn official-modules` to
  inspect/change activation; the `postinstall` worker (`scripts/official-modules-setup.mjs`) —
  a no-op until the submodule is registered, then it inits/refreshes it — regenerates
  `apps/helios/src/official-modules.generated.ts`, which `apps/helios/src/modules.ts` spreads
  into `enabledModules`.
- **Module-id convention:** package `@helios/<suffix>` ⇒ module id `<suffix>` with dashes
  converted to underscores (e.g. `@helios/ai-assistant` ⇒ `ai_assistant`).
- **Edits under `external/official-modules/` commit to the submodule's git, not
  helios's.** Commit/push from inside `external/official-modules/` on a feature branch;
  create the changeset there (`yarn changeset`); open the PR against
  `helios/official-modules`.
- **Never `git add external/official-modules` (pointer bump) unless explicitly asked** — the
  pointer may lag intentionally. Always check `git diff --staged` before committing in the host
  repo. The same applies to `apps/helios/src/official-modules.generated.ts` /
  `official-modules.json` `available` churn unless you actually intend to change the activation
  set.
- After activating/deactivating official modules: run
  `yarn helios configs cache structural --all-tenants` (and `yarn dev:reset` if Turbopack
  serves a stale chunk).
- **Cross-cutting changes** (core API + an official module): two coordinated PRs — core in
  helios first → (prerelease) publish → submodule bumps the peer dep → submodule PR.
  Explain the merge order to the user. No PR is atomic across the two repos.
