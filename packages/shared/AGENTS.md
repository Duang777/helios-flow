# Shared Package — Agent Guidelines

Use `@helios/shared` for cross-cutting utilities, types, DSL helpers, and infrastructure. MUST NOT import from `@helios/core` or any domain package — shared has zero domain dependencies.

## Always

1. **MUST use precise types** — no `any`, use zod schemas + `z.infer`
2. **MUST check for existing utilities** before adding new helpers — avoid duplication
3. **MUST export narrow interfaces** (e.g., `QueryEngine`) — never pass `any`/`unknown`
4. **MUST centralize reusable types and constants here** to prevent drift across packages

## Ask First

- Ask before adding a domain-specific helper, new override domain, or shared public type that becomes a cross-package contract.
- Ask before changing import paths documented in this file.

## Never

- Never add domain-specific logic; this package is infrastructure only.
- Never import from `@helios/core` or any domain package; shared has zero domain dependencies.
- Never gate raw feature arrays with `includes(...)`, `Set.has(...)`, or ad hoc wildcard matching.
- Never use `any` for exported shared interfaces.

## Validation Commands

```bash
yarn workspace @helios/shared test
yarn workspace @helios/shared build
```

## Library Directory (`src/lib/`)

| Directory | When to use | Import path |
|-----------|-------------|-------------|
| `api/` | When building scoped API payloads | `@helios/shared/lib/api/scoped` |
| `auth/` | When you need wildcard-aware feature matching or shared auth helpers | `@helios/shared/lib/auth/featureMatch` |
| `boolean/` | When parsing boolean strings from env/query params | `@helios/shared/lib/boolean` |
| `browser/` | When persisting client UI state to `localStorage` — use the safe wrappers and the versioned-envelope helper instead of raw `localStorage` reads/writes | `@helios/shared/lib/browser/safeLocalStorage`, `@helios/shared/lib/browser/versionedPreference` |
| `commands/` | When implementing undo/redo command pattern | `@helios/shared/lib/commands` |
| `commands/flush` | When a command mutates entities across multiple phases (scalar + relation syncs) — wraps phases in a single atomic flush | `@helios/shared/lib/commands/flush` — `withAtomicFlush(em, phases, { transaction? })` |
| `commands/runCrudCommandWrite` | When a command writes an entity + custom fields + CRUD/index side effects in one logical operation — composes fork → atomic flush → custom-field write → side-effect queue in the only correct order. **Prefer this over composing the primitives by hand for new commands.** | `@helios/shared/lib/commands/runCrudCommandWrite` — `runCrudCommandWrite({ ctx, entityId, action, scope, phases, customFields?, events?, indexer?, sideEffect })` |
| `crud/` | When building CRUD routes | `@helios/shared/lib/crud` |
| `custom-fields/` | When handling custom field payloads | `@helios/shared/lib/custom-fields` |
| `data/` | When you need `DataEngine` or `QueryEngine` types | `@helios/shared/lib/data/engine` |
| `db/` | When resolving the ORM/connection-pool config (`resolvePoolConfig`, pool/timeout env knobs) | `@helios/shared/lib/db/mikro` |
| `di/` | When setting up dependency injection (Awilix) | `@helios/shared/lib/di` |
| `encryption/` | When querying encrypted entities (MUST use instead of raw `em.find`) | `@helios/shared/lib/encryption/find` |
| `i18n/` | When translating strings — `useT()` client-side, `resolveTranslations()` server-side | `@helios/shared/lib/i18n/context` or `/server` |
| `indexers/` | When building query index helpers | `@helios/shared/lib/indexers` |
| `logger/` | When emitting diagnostics — `createLogger(namespace)` instead of raw `console.*` (migrate incrementally, Boy Scout rule). Message-first with structured fields (`logger.warn('Payload too large', { event, maxBytes })`), errors under `err`, `child(bindings)` for context, `getLogLevel()`/`isLevelEnabled()` to gate expensive fields; level via `HELIOS_LOG_LEVEL`. Never log credentials, PII, or payload bodies | `@helios/shared/lib/logger` |
| `modules/` | When registering or listing modules | `@helios/shared/lib/modules/registry` |
| `number.ts` | When parsing numeric strings from env/query params with a fallback and optional min/integer constraint | `@helios/shared/lib/number` |
| `openapi/` | When generating CRUD OpenAPI specs | `@helios/shared/lib/openapi/crud` |
| `profiler/` | When profiling with `HELIOS_PROFILE` env flag | `@helios/shared/lib/profiler` |
| `string.ts` | When parsing comma-separated lists from CLI args/query params, or coercing a string to `undefined` when blank | `@helios/shared/lib/string` |
| `testing/` | When bootstrapping tests — register only what the test needs | `@helios/shared/lib/testing/bootstrap` |

## Module Types (`src/modules/`)

When you need shared type definitions, import from these:

| Need | Import from |
|------|-------------|
| Dashboard widget types | `@helios/shared/modules/dashboard/widgets` |
| DSL helpers (`defineLink`, `entityId`, `cf.*`) | `@helios/shared/modules/dsl` |
| Event declarations (`createModuleEvents`) | `@helios/shared/modules/events` |
| Search config types (`SearchModuleConfig`) | `@helios/shared/modules/search` |
| Module setup types (`ModuleSetupConfig`) | `@helios/shared/modules/setup` |
| Module registry types (`Module`) | `@helios/shared/modules/registry` |
| Module-level overrides (`ModuleOverrides`, dispatcher, per-domain compose helpers) | `@helios/shared/modules/overrides` |

## Key Patterns

### Database Connection Pool — MUST keep total demand under `max_connections`

The MikroORM pool is configured from env via `resolvePoolConfig(process.env)` in
`@helios/shared/lib/db/mikro` (pure and unit-testable). Each process gets
its own pool (`DB_POOL_MAX`, default 20). Because background worker jobs each run
in their own request container (one pooled connection per in-flight job), the
peak connection demand of all processes against one database is additive.

- **Invariant:** `web_pool_max + worker_pool_max + scheduler/overhead ≤ Postgres max_connections` (with headroom). Violating it lets background work starve the request/onboarding path — see `packages/queue/AGENTS.md` → Connection Budget.
- Tune per process with `DB_POOL_MAX` (and the opt-in `DB_STATEMENT_TIMEOUT_MS` / `DB_LOCK_TIMEOUT_MS`; `idle_in_transaction` defaults to a finite 120s). Bound the worker's job concurrency with `HELIOS_WORKERS_DB_CONNECTION_BUDGET`.

### Encryption — MUST use instead of raw ORM queries

```typescript
import { findWithDecryption, findOneWithDecryption } from '@helios/shared/lib/encryption/find'
const results = await findWithDecryption(em, 'Entity', filter, { tenantId, organizationId })
```

### Boolean Parsing — MUST use instead of ad-hoc parsing

```typescript
import { parseBooleanToken, parseBooleanWithDefault } from '@helios/shared/lib/boolean'
```

### Comma-Separated List Parsing — MUST use instead of ad-hoc splitting

```typescript
import { parseCommaSeparatedList } from '@helios/shared/lib/string'
```

`parseCommaSeparatedList(value)` splits on commas, trims each entry, and drops blanks. Non-string
inputs (`null`/`undefined`) yield `[]`. MUST use it instead of hand-rolling
`value.split(',').map((s) => s.trim()).filter(Boolean)` when reading CLI flags or query params.

Keep the surrounding guard when a call site distinguishes "not supplied" (`undefined`) from
"supplied but empty" (`[]`) — the helper always returns an array:

```typescript
const roleNames = rolesCsv ? parseCommaSeparatedList(rolesCsv) : undefined
```

### Browser Storage — use the shared helpers instead of raw `localStorage`

Persisted client UI state MUST go through the shared `browser/` helpers, never raw `window.localStorage` reads/writes scattered per component:

```typescript
import { readJsonFromLocalStorage, writeJsonToLocalStorage } from '@helios/shared/lib/browser/safeLocalStorage'
import { readVersionedPreference, writeVersionedPreference, clearVersionedPreference } from '@helios/shared/lib/browser/versionedPreference'
```

- `safeLocalStorage` — SSR-safe, error-swallowing JSON get/set/remove. Use for raw values.
- `versionedPreference` — wraps a value in a `{ v, data }` envelope so schema changes can migrate or safely discard stale data. `readVersionedPreference(key, version, isValid, fallback, { legacyIsValid })` validates the envelope, discards version-mismatched or malformed data, and (when `legacyIsValid` is supplied) migrates a pre-envelope bare value forward on the next write. `readVersionedIdSet`/`writeVersionedIdSet` are convenience wrappers for the common "set of ids" shape.

**Versioning threshold** — when to reach for `versionedPreference` vs. a raw scalar:

- **Trivial scalar flags** (a single boolean/number/string with no schema to evolve, e.g. `om:sidebarCollapsed`, `om:progress:expanded`) MAY stay raw via `safeLocalStorage` (or a plain `'1'`/`'0'`). Add a one-line comment noting the deliberate choice.
- **Structured values** (objects, records, arrays of objects — anything whose shape can change incompatibly, e.g. a perspective snapshot, a model-picker selection, a sessions cache) MUST use a versioned envelope so a future shape change can migrate or discard old data instead of crashing or silently corrupting state.
- A slot that already carries its own inline version discriminator (e.g. `{ v, ... }` checked on read) is already migratable and need not be re-wrapped — re-wrapping changes the on-disk format and discards existing user data.

### i18n — MUST use for all user-facing strings

```typescript
// Client-side (React components)
import { useT } from '@helios/shared/lib/i18n/context'
const t = useT()

// Server-side
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
const { t } = await resolveTranslations()
```

**User-facing vs internal errors.** When a `throw new Error(...)`, `createCrudFormError(...)`, `raiseCrudError(...)`, or `toast.*(...)` message will surface to a user, route it through `t('module.errors.<key>')`. When it's a developer-only assertion (programming bug, container/wiring issue, contract violation that should never be triggered at runtime), prefix the literal with `[internal]` so the i18n hardcoded-string checker treats it as opted out:

```typescript
throw new Error('[internal] Event bus not available in container')
```

The detection scripts (`yarn i18n:check-hardcoded`, `yarn i18n:check-values`) live in `scripts/`. See `.ai/specs/2026-05-26-missing-translations-audit-and-remediation.md` for the full convention and the per-module allowlist format (`<module>/i18n/.hardcoded-allowlist.json`).

### Request Scoping — use for scoped API payloads

```typescript
import { withScopedPayload, createScopedApiHelpers } from '@helios/shared/lib/api/scoped'
```

### Feature Matching — MUST use shared wildcard-aware helpers

Use shared helpers whenever you evaluate raw granted feature arrays in infrastructure code:

```typescript
import { hasFeature, hasAllFeatures } from '@helios/shared/security/features'
```

- Use `hasFeature(granted, 'module.action')` for single-feature checks.
- Use `hasAllFeatures(granted, required)` for arrays such as `features`, `requireFeatures`, or handler guard lists.
- MUST NOT gate raw feature arrays with `includes(...)`, `Set.has(...)`, or ad hoc `every(...includes(...))` checks in shared registries or runners; wildcard grants like `module.*` and `*` are part of the RBAC contract.

### CRUD HTTP Errors — MUST use the shared helpers instead of hand-rolling `CrudHttpError`

`@helios/shared/lib/crud/errors` owns the standardized error shapes. Use the helper, not a raw `new CrudHttpError(...)`:

```typescript
import { assertFound, notFound, badRequest, forbidden, conflict } from '@helios/shared/lib/crud/errors'

const deal = assertFound(await em.findOne(Deal, { id }), translate('customers.errors.deal_not_found', 'Deal not found'))
```

| Status | Helper |
|--------|--------|
| 400 | `badRequest(message)` |
| 403 | `forbidden(message?)` |
| 404 | `notFound(message?)` — or `assertFound(value, message)` when guarding a lookup |
| 409 | `conflict(message)` |

MUST rules:
- MUST NOT hand-roll `throw new CrudHttpError(404, { error: msg })`. Pick the helper that fits the call site:
  - **Inline lookup** → `const deal = assertFound(await em.findOne(Deal, { id }), msg)`. It throws the standardized 404 and returns the value narrowed to `T`, so there is no nullable intermediate binding.
  - **Guard statement** (multi-line lookup, or a compound condition such as `if (!entity || entity.tenantId !== auth.tenantId)`) → `throw notFound(msg)`. TypeScript already narrows the value after the throw, so this keeps tenant-scoping conditions explicit without losing type safety.
- `message` is passed through verbatim and is never derived from an entity name — keep routing 404 copy through `translate(...)` so it stays translatable.
- `assertFound` treats every falsy value as missing. Use it for entity/object lookups only, never to guard numbers or strings where `0`/`''` are valid results.

### CRUD Multi-ID Filtering

- Use `parseIdsParam()` and `mergeIdFilter()` from `@helios/shared/lib/crud/ids` for factory-level `ids` query support.
- Keep `ids` format as comma-separated UUIDs (`?ids=uuid1,uuid2`) and intersect with existing `id` filters.

### Command Undo Pattern — read the snapshot via `extractUndoPayload`

A command's `buildLog()` returns `payload: { undo: { before, after } }`, but the command bus persists that under `commandPayload` (column `command_payload`, wrapped in a redo envelope) — **the stored `ActionLog` row has no top-level `payload`**. Reading `logEntry.payload` inside an `undo()` handler is therefore always `undefined`, which makes undo a silent no-op (issue #2504).

MUST rules:
- Inside `undo()`, read the snapshot **only** through `extractUndoPayload<UndoPayload<TSnapshot>>(logEntry)` from `@helios/shared/lib/commands/undo`. It unwraps `commandPayload` (and the redo envelope) and falls back to `snapshotBefore`/`snapshotAfter`.
- NEVER access `logEntry.payload` in an undo handler. The `logEntry` parameter is typed as `CommandUndoLogEntry`, which intentionally omits `payload` so this footgun is a compile-time error.
- Delete-undo should be robust to either deletion strategy: clear `deletedAt` when the row survives (soft delete), otherwise re-create the entity from the snapshot (mirror `packages/core/src/modules/sales/commands/configuration.ts`).

### Module-Level Overrides (`@helios/shared/modules/overrides`)

Downstream apps replace or disable any contract a module presents through a single `entry.overrides` field on a `ModuleEntry`. The umbrella spec is `.ai/specs/implemented/2026-05-04-modules-ts-unified-overrides.md`; phases 1-18 are wired.

| Use case | Helper |
|----------|--------|
| Walk `enabledModules` and dispatch every `overrides.<domain>` shape to wired appliers | `applyModuleOverridesFromEnabledModules(enabledModules)` |
| Register a per-domain runtime hook (used by each wired phase) | `registerModuleOverrideApplier('<domain>', applier)` |
| API routes | `applyApiRouteOverrides()`, `composeApiRouteOverrides()`, `applyApiOverridesToManifests()` |
| Page routes | `applyPageRouteOverrides()`, `composePageRouteOverrides()`, `applyPageOverridesToManifests()` |
| Subscribers / workers / CLI / ACL / encryption / setup | `applyModuleOverridesToModules()` plus `applySubscriberOverrides()`, `applyWorkerOverrides()`, `applyCliOverrides()`, `applyAclFeatureOverrides()`, `applyEncryptionMapOverrides()` |
| Widgets | `applyInjectionWidgetOverridesToEntries()`, `applyInjectionWidgetOverridesToTables()`, `applyDashboardWidgetOverridesToEntries()`, `applyComponentOverridesToEntries()` |
| Notifications / interceptors / enrichers / guards | `applyNotificationTypeOverridesToEntries()`, `applyNotificationHandlerOverridesToEntries()`, `applyApiInterceptorOverridesToEntries()`, `applyCommandInterceptorOverridesToEntries()`, `applyResponseEnricherOverridesToEntries()`, `applyPageGuardOverridesToEntries()` |
| DI | `applyDiOverridesToContainer()` |

MUST rules:
- `entry.overrides` is the ONLY canonical override surface — never patch upstream module source.
- API-route override keys are `'METHOD /api/path'` (method case-insensitive, path leading slash optional). Trailing slashes are stripped.
- Page-route override keys are `'/backend/path'` or `'/frontend/path'`.
- `null` disables the matching method; `{ handler, metadata? }` replaces it. Disabling every method on an entry drops the entry.
- The dispatcher SHOULD run from `bootstrap.ts` BEFORE any registry first-loads (`registerApiRouteManifests`, widget registries, notification registries, etc.) so the overrides take effect when the registry stores entries.
- Adding a new override domain MUST follow the umbrella spec: typed sub-shape + composer + runtime hook + tests + AGENTS.md/docs update + status-table tick.

### Query Engine Extensibility (UMES)

Query engines support optional extension hooks via `QueryOptions.extensions`:

```typescript
import type { QueryExtensionsConfig } from '@helios/shared/lib/query/types'

const result = await queryEngine.query('customers:person', {
  tenantId: auth.tenantId,
  organizationId: auth.orgId,
  extensions: {
    userId: auth.userId,
    container: diContainer,
    userFeatures: auth.features,
    resolve: (name) => diContainer.resolve(name),
  },
})
```

When `extensions` is provided:
- Sync `*.querying` subscribers can block or modify query options.
- Query-level enrichers (with `queryEngine.enabled: true`) run after the SQL query.
- Sync `*.queried` subscribers can modify the final result.
- Tenant/org scope guards are always re-applied after subscriber modifications.

Key types:
- `QueryExtensionsConfig` — Extension context (`@helios/shared/lib/query/types`)
- `EnricherQueryEngineConfig` — Enricher opt-in config (`@helios/shared/lib/crud/response-enricher`)
- `EnricherSurfaceSelector` — Registry selector (`@helios/shared/lib/crud/enricher-registry`)
- `SyncQueryEventPayload` / `SyncQueryEventResult` — Event contracts (`@helios/shared/lib/query/sync-query-event-types`)

To enable an enricher for query-engine pipelines, add `queryEngine` config:
```typescript
const enricher: ResponseEnricher = {
  id: 'mymodule.enricher',
  targetEntity: 'customers.person',
  queryEngine: { enabled: true, engines: ['basic', 'hybrid'], applyOn: ['list', 'detail'] },
  // ... enrichOne, enrichMany
}
```

## Before Adding a New Utility

1. Search existing `src/lib/` directories for similar functionality
2. Check if the utility belongs here (infrastructure) or in a domain package
3. Export a narrow, typed interface — avoid leaking implementation details
4. Add tests in `__tests__/`
5. Verify no circular dependency with domain packages
