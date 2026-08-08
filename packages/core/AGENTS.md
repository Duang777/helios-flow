# Core Package Guidelines

`@helios/core` owns core business modules. Long-form historical guidance moved to
`../../.ai/docs/agent-guides/core-agents-guidelines.md`.

Use this file with the nearest module `AGENTS.md`, `BACKWARD_COMPATIBILITY.md`,
`.ai/docs/module-development.md`, and the relevant spec in `.ai/specs/`.

## Always

- Preserve auto-discovery contracts for module files, routes, subscribers,
  workers, widgets, setup, search, notifications, AI agents/tools, and generated
  registries.
- Export `openApi` from every API route file.
- Use `makeCrudRoute` for CRUD and set `indexer: { entityType }` when the entity
  should participate in query indexing.
- Wire custom write routes through the mutation guard registry.
- Use declarative feature guards and add new `acl.ts` features to `setup.ts`
  `defaultRoleFeatures`.
- Scope every tenant entity/query/command by `tenantId` and `organizationId`.
- Use `findWithDecryption` / `findOneWithDecryption` for encrypted entities.
- Implement domain writes through commands so audit, undo, cache, events, and
  indexing remain consistent.
- Use `withAtomicFlush` or existing command helpers around scalar mutations that
  are followed by reads/side effects on the same `EntityManager`.
- Run `yarn generate` after changing generator-discovered module structure.

## Ask First

- Ask before changing any contract surface listed in `BACKWARD_COMPATIBILITY.md`.
- Ask before moving versioned generated files or changing generated registry
  locations/contracts.
- Ask before applying migrations with `yarn db:migrate`; PRs normally include
  migration files and snapshots, not local DB state.

## Never

- Never create direct ORM relationships between modules; use UUID fields, events,
  widgets, enrichers, or optional DI ports.
- Never expose cross-tenant data or omit org/tenant filters.
- Never hand-edit generated files.
- Never import generated app bootstrap files from packages.
- Never run raw `em.find` / `em.findOne` between scalar mutations and `em.flush()`
  on the same `EntityManager` without `withAtomicFlush`.
- Never hand-roll encryption or bypass `TenantDataEncryptionService`.
- Never compare feature arrays with exact string checks when wildcard grants apply.

## Validation Commands

```bash
yarn db:generate
yarn generate
yarn workspace @helios/core test
yarn workspace @helios/core build
yarn agents:check-budget
```

## Module Layout

Standard module files are contract surfaces. Additive files are okay; do not
rename or remove existing conventions.

| File/Dir | Purpose |
|---|---|
| `index.ts` | module metadata |
| `acl.ts` | feature ids |
| `setup.ts` | tenant init and default role grants |
| `data/entities.ts` | MikroORM entities |
| `data/validators.ts` | Zod schemas |
| `api/<resource>/route.ts` | API routes |
| `commands/*.ts` | domain writes |
| `events.ts` | typed events |
| `widgets/**` | injected UI |
| `ai-agents.ts`, `ai-tools.ts` | focused AI surfaces |
| `search.ts`, `notifications.ts`, `data/extensions.ts` | optional discovered surfaces |

Routing conventions:

- `backend/<path>.tsx` -> `/backend/<path>`
- `frontend/<path>.tsx` -> `/<path>`
- `api/<method>/<path>.ts` -> `/api/<path>` by HTTP method
- `subscribers/*.ts` exports default handler + `metadata`
- `workers/*.ts` exports default handler + `metadata`

Portal pages live under `frontend/[orgSlug]/portal/...` and require sibling
metadata with `requireCustomerAuth` / `requireCustomerFeatures`.

## API And CRUD

- API route `metadata` must declare `requireAuth` and `requireFeatures`.
- Custom writes must run `runMutationGuards(...)` with caller `userFeatures`,
  merge `modifiedPayload`, and run `afterSuccessCallbacks` after commit.
- List APIs must paginate and keep `pageSize <= 100`.
- Use module-local `api/openapi.ts` with `createCrudOpenApiFactory`.
- For list projections, prefer `list.fields(query, ctx)` only to drop large
  detail-only columns; keep response keys stable.
- Custom entities should follow `customers` CRUD patterns and set query-index
  entity ids.

## Entities And Migrations

- Use MikroORM v7 decorators from `@mikro-orm/decorators/legacy` and types from
  `@mikro-orm/core`.
- Standard fields: `id`, `organization_id`, `tenant_id`, `created_at`,
  `updated_at`, `deleted_at`, `is_active`.
- Editable entities must expose `updatedAt` for optimistic locking.
- Default workflow: edit entities -> `yarn db:generate` -> review generated SQL
  and affected `migrations/.snapshot-helios.json`.
- If generator emits unrelated migrations, delete unrelated output and keep only
  intended SQL/snapshot changes.
- Do not run `yarn db:migrate` unless explicitly requested.

## Setup And ACL

- `setup.ts` is idempotent.
- Grant new module features in `defaultRoleFeatures` for admin and other roles
  that should receive them.
- Use `yarn helios auth sync-role-acls` when existing tenants need new grants.
- Prefer feature ids over role names in guards.

## Cross-Module Coupling

Choose the least coupled sanctioned mechanism:

- events/subscribers for write side effects
- widget injection and response enrichers for read/UI composition
- UUID foreign-key fields plus denormalized snapshots for data references
- optional `container.resolve(...)` wrapped in a local `tryResolve` helper for
  optional integrations

Disabled-module behavior must degrade gracefully; see
`packages/core/src/__tests__/module-decoupling.test.ts`.

## Events, Notifications, Widgets

- Event ids are `module.entity.action` with singular entity and past-tense action.
- Use `createModuleEvents`.
- Set `clientBroadcast: true` / `portalBroadcast: true` only when browser bridges
  need the event.
- Widget spot ids and replacement handles are frozen once shipped.
- Notification ids/types are frozen once shipped; add, do not rename.

## Commands And Side Effects

- Commands own writes and should emit CRUD side effects through existing helpers.
- Keep audit, undo/redo, cache invalidation, events, and query-index refresh on
  the same command path as UI/API writes.
- Avoid direct service construction; resolve dependencies via DI.

## Key References

- Module development: `.ai/docs/module-development.md`
- Backward compatibility: `BACKWARD_COMPATIBILITY.md`
- API CRUD factory: `apps/docs/docs/framework/api/crud-factory.mdx`
- Concurrency locking: `apps/docs/docs/framework/data-integrity/concurrency-locking.mdx`
- Logging: `apps/docs/docs/framework/runtime/logging.mdx`
- AI agents/tools: `.ai/skills/helios-create-ai-agent/SKILL.md` and
  `packages/ai-assistant/AGENTS.md`
