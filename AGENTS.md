# Agents Guidelines

Keep this file compact. Codex loads the root-to-directory `AGENTS.md` chain within
a 32,768 byte budget; long procedures belong in `.ai/docs/*`, specs, or package
docs. See `.ai/docs/agent-instructions.md` and run `yarn agents:check-budget`.

Long-form historical guidance moved from this file lives at
`.ai/docs/agent-guides/root-agents-guidelines.md`.

## Always

- Check this Task Router before research or coding; a task may match multiple rows.
- Check `.ai/specs/` and `.ai/specs/enterprise/` before modifying a module.
- For non-trivial work, keep a plan, slice changes vertically, and verify each slice.
- Preserve behavior unless the user or a spec explicitly asks for behavior change.
- Keep changes minimal, focused, and wired through real call sites.
- Use the nearest package/module `AGENTS.md` for local architecture and validation.
- Read `BACKWARD_COMPATIBILITY.md` before touching any contract surface.
- Run `yarn generate` after changing generator-discovered module files.
- Use the `customers` module as the CRUD reference.
- Support optimistic locking for every new user-editable entity and edit/delete form:
  add `updated_at`, return `updatedAt`, let `CrudForm` derive the lock header, or use
  `buildOptimisticLockHeader` / `surfaceRecordConflict` for custom handlers.

## Ask First

- Ask before reducing scope, changing architecture, adding production dependencies,
  changing public contracts, or touching multiple modules outside an existing spec.
- Ask before changing branch/PR automation, pipeline labels, QA flow, release
  behavior, or external official-module submodule pointers.
- Ask before applying database migrations locally with `yarn db:migrate`.
- Ask before introducing provider-specific preconfiguration outside its provider package.

## Never

- Never expose cross-tenant data or skip tenant/organization scoping.
- Never edit generated files by hand.
- Never add code directly under `apps/helios/src/` except committed typed
  `*.generated.ts` registries described in `.ai/docs/module-development.md`.
- Never create direct ORM relationships between modules.
- Never bypass mutation guards, command side effects, encryption helpers, RBAC
  wildcard matching, or shared UI data-call helpers.
- Never hard-code user-facing strings or design-system status colors.
- Never commit credentials, raw tokens, private keys, local-only ops files, or
  fork-only infrastructure notes.

## Validation Commands

Choose the smallest relevant set. Decide local vs Docker once per gate sequence
using `.ai/docs/agent-instructions.md`; record the runner in your output.

```bash
yarn generate
yarn build:packages
yarn typecheck
yarn lint
yarn test
yarn build:app
yarn agents:check-budget
```

The full CI-mirroring ordered gate is `.ai/agentic.config.json` `validation.commands`.

## Task Router

Read all matching guides before coding. Guide shorthand: `<pkg>` =
`packages/<pkg>/AGENTS.md`; `core:<module>` =
`packages/core/src/modules/<module>/AGENTS.md`; `ui:backend` =
`packages/ui/src/backend/AGENTS.md`.

| Task | Required Guide |
|---|---|
| New module, scaffolding, auto-discovery | `core` + `.ai/docs/module-development.md` |
| Official modules / `external/official-modules` | `.ai/docs/official-modules.md` |
| CRUD API routes, `makeCrudRoute`, OpenAPI | `core` -> API Routes |
| `setup.ts`, tenant init, ACL grants | `core` -> Module Setup |
| Typed events / subscribers | `core` -> Events |
| Notifications | `core` -> Notifications + `ui` |
| Widgets / injection / component replacement | `core` -> Widgets, Widget Injection, Component Replacement + `ui` |
| DataTable / CrudForm / backend page UI | `ui` + `ui:backend` |
| Bulk operations / progress | `core:progress` + `ui` + `queue` |
| Custom fields / entity extensions | `core` -> Custom Fields / Extensions |
| Cross-module coupling | `core` -> Cross-Module Coupling |
| RBAC / wildcard feature checks | `core` -> Access Control + `shared` + `ui` + affected module |
| Encryption / GDPR fields | `core` -> Encryption |
| Response enrichers / API interceptors | `core` -> Response Enrichers / API Interceptors |
| Optimistic locking | `apps/docs/docs/framework/data-integrity/concurrency-locking.mdx` + `.ai/specs/2026-05-28-optimistic-locking-coverage-completion.md` |
| DOM event bridge / operation progress | `events` -> DOM Event Bridge + `core:progress` |
| Customer portal | `ui` -> Portal Extension + customer portal module guide |
| AI agents/tools | `.ai/skills/helios-create-ai-agent/SKILL.md` + `ai-assistant` + `apps/docs/docs/framework/ai-assistant/*.mdx` |
| AI loop controls / overrides | `ai-assistant` -> Loop controls + `.ai/specs/implemented/2026-04-28-ai-agents-agentic-loop-controls*` |
| Specific module work | `packages/core/src/modules/<module>/AGENTS.md` when present |
| Webhooks | `webhooks` + `queue` + `events` + `core:integrations` + `ui` |
| Integration provider | `.ai/skills/helios-integration-builder/SKILL.md` + `core:integrations` + `core:data_sync` |
| Shared utilities / i18n / data types | `shared` |
| Structured logging | `apps/docs/docs/framework/runtime/logging.mdx` + `.ai/specs/2026-07-02-structured-logging-facade.md` + `shared` |
| Reusable backend component families | `.ai/ui-backend-components.md` + `ui` |
| Search | `search` |
| Generators / migrations / build order | `cli` |
| Cache | `cache` |
| Queue / workers | `queue` |
| Onboarding | `onboarding` |
| Static content | `content` |
| Standalone create-app / template sync | `create-app` |
| Railway deploy | `.ai/specs/2026-05-12-railway-one-command-deploy.md` + `apps/docs/docs/deployment/railway.mdx` + `cli` |
| Dev memory profiling | `.ai/specs/2026-05-27-dev-mode-memory-quick-wins.md` + `scripts/profile-dev-rss.mjs` |
| MikroORM v6 -> v7 migration | `.ai/skills/helios-migrate-mikro-orm/SKILL.md` |
| Integration / Playwright tests | `.ai/qa/AGENTS.md` + `.agents/skills/helios-integration-tests/SKILL.md` |
| Spec lifecycle / review / DS review | `.ai/specs/AGENTS.md` + relevant `helios-*` skills |
| PR automation | `.ai/docs/pr-workflow.md` + relevant `helios-auto-*` skills |
| Editing AGENTS.md | `.ai/docs/agent-instructions.md` + `scripts/check-agents-md-budget.mjs` |

## Package Map

- `apps/helios`: main Next.js app. User/app modules go in `apps/helios/src/modules/`.
- `apps/docs`: documentation site.
- `packages/shared`: utilities, types, i18n, DSL helpers, data/query engine types.
- `packages/ui`: primitives, backend UI, portal UI, shared data-call helpers.
- `packages/core`: core business modules.
- `packages/cli`: generators, migrations, scaffolding, build orchestration.
- `packages/cache`, `queue`, `events`, `search`, `ai-assistant`, `content`,
  `onboarding`, `enterprise`: package-owned runtime surfaces.
- External providers live in dedicated workspace packages such as
  `packages/gateway-stripe`; do not add provider modules under `packages/core/src/modules/`.
- `external/official-modules` is an optional real git submodule. Never stage its
  pointer unless explicitly asked; see `.ai/docs/official-modules.md`.

## Code Placement

- Core platform features: `packages/<package>/src/modules/<module>/`.
- Shared utilities/types: `packages/shared/src/lib/` or `packages/shared/src/modules/`.
- UI components: `packages/ui/src/`.
- User/app-specific modules: `apps/helios/src/modules/<module>/`.
- Avoid `apps/helios/src/` boilerplate edits except versioned generated registries.

## Contracts

Read `BACKWARD_COMPATIBILITY.md` before modifying public surfaces. Frozen/stable
surfaces include auto-discovery files, exported types/signatures/import paths,
event IDs, widget spot IDs, API routes, DB schema, DI names, ACL features,
notification IDs, AI agent/tool/UI part IDs, CLI commands, and generated file shapes.

Deprecation protocol: never remove in one release; add `@deprecated`; provide a
bridge for at least one minor; document in `UPGRADE_NOTES.md`; reference a spec
with migration/backward compatibility notes.

## Architecture And Data

- Modules use plural snake_case folders and ids; JS/TS identifiers use camelCase;
  DB tables/columns use snake_case.
- Common columns: `id`, `created_at`, `updated_at`, `deleted_at`, `is_active`,
  `organization_id`, `tenant_id`.
- UUID primary keys, explicit FK-id fields, junction tables for many-to-many.
- Validate external input with Zod at boundaries and derive TS types with `z.infer`.
- Use `findWithDecryption` / `findOneWithDecryption` for encrypted entities.
- Use DI via Awilix; avoid ad hoc `new` for services.
- Default migration workflow: update entities, run `yarn db:generate`, review SQL
  and `migrations/.snapshot-helios.json`. If unrelated migrations appear, delete
  unrelated output and keep only intended SQL/snapshot changes. Do not run
  `yarn db:migrate` just to quiet the generator.
- Hash passwords with bcryptjs cost >= 10; never log credentials.
- RBAC: prefer immutable feature guards (`requireFeatures`), not role-name checks.

## UI And HTTP

- Use `apiCall` / `apiCallOrThrow` / `readApiResultOrThrow`; never raw `fetch`.
- Use `CrudForm` writes (`createCrud` / `updateCrud` / `deleteCrud`) where possible.
- If a write cannot use `CrudForm`, wrap it with `useGuardedMutation(...).runMutation(...)`
  and include `retryLastMutation` in injection context.
- For local validation errors use `createCrudFormError`; prefix internal-only
  messages with `[internal]`.
- Read JSON defensively with `readJsonSafe(response, fallback)`.
- Use `LoadingMessage` / `ErrorMessage`.
- Use `useT()` client-side and `resolveTranslations()` server-side.
- Every dialog supports `Cmd/Ctrl+Enter` submit and `Escape` cancel.
- Keep `pageSize` at or below 100.

## Design System

Read `.ai/ds-rules.md`, `.ai/ui-components.md`, and `packages/ui/AGENTS.md`.

- Never hard-code Tailwind status colors; use semantic status tokens.
- Never use arbitrary values or hardcoded hex/rgb in `className`.
- Never add `dark:` overrides on semantic/status tokens.
- Never use hardcoded border color shades; use `border-border` / `border-input`.
- Boy Scout Rule: when touching a file with status-color/arbitrary-value issues,
  migrate at least the lines you touched.

## Key Commands

```bash
yarn dev
yarn dev:reset
yarn build
yarn lint
yarn test
yarn test:integration
yarn generate
yarn db:generate
yarn initialize
yarn agents:check-budget
```
