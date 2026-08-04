# Shared Package — Standalone Developer Guide

`@helios/shared` provides cross-cutting utilities, types, and DSL helpers. Import from here for infrastructure concerns — never from `@helios/core`.

## Import Map

| Need | Import |
|------|--------|
| Client-side translations | `import { useT } from '@helios/shared/lib/i18n/context'` |
| Server-side translations | `import { resolveTranslations } from '@helios/shared/lib/i18n/server'` |
| Encrypted queries | `import { findWithDecryption, findOneWithDecryption } from '@helios/shared/lib/encryption/find'` |
| Boolean parsing | `import { parseBooleanToken, parseBooleanWithDefault } from '@helios/shared/lib/boolean'` |
| Command pattern | `import { registerCommand } from '@helios/shared/lib/commands'` |
| Safe entity flush | `import { withAtomicFlush } from '@helios/shared/lib/commands/flush'` |
| Data/Query engine types | `import type { DataEngine, QueryEngine } from '@helios/shared/lib/data/engine'` |
| CRUD multi-ID filtering | `import { parseIdsParam, mergeIdFilter } from '@helios/shared/lib/crud/ids'` |
| CRUD OpenAPI factory | `import { createCrudOpenApiFactory } from '@helios/shared/lib/openapi/crud'` |
| Scoped API payloads | `import { withScopedPayload } from '@helios/shared/lib/api/scoped'` |
| DI setup (Awilix) | `import { ... } from '@helios/shared/lib/di'` |
| Custom field helpers | `import { splitCustomFieldPayload, normalizeCustomFieldValues } from '@helios/shared/lib/custom-fields'` |
| DSL helpers | `import { defineLink, entityId, cf } from '@helios/shared/modules/dsl'` |
| Event declarations | `import { createModuleEvents } from '@helios/shared/modules/events'` |
| Module setup types | `import type { ModuleSetupConfig } from '@helios/shared/modules/setup'` |
| Search config types | `import type { SearchModuleConfig } from '@helios/shared/modules/search'` |
| Widget injection position | `import { InjectionPosition } from '@helios/shared/modules/widgets/injection-position'` |
| API interceptor types | `import type { ApiInterceptor } from '@helios/shared/lib/crud/api-interceptor'` |
| Response enricher types | `import type { ResponseEnricher } from '@helios/shared/lib/crud/response-enricher'` |
| Broadcast event check | `import { isBroadcastEvent } from '@helios/shared/modules/events'` |

## i18n — All User-Facing Strings

Never hard-code user-facing text. Use locale files and translation helpers.

```typescript
// Client-side (React components)
const t = useT()
return <span>{t('my_module.labels.title')}</span>

// Server-side (API routes, commands)
const { t } = await resolveTranslations()
const label = t('my_module.labels.title')
```

Add translations to `i18n/<locale>.json` files in your module.

## Encryption — Query Encrypted Entities

MUST use these instead of raw `em.find`/`em.findOne` when the entity may contain encrypted fields:

```typescript
const results = await findWithDecryption(em, 'Entity', filter, { tenantId, organizationId })
const record = await findOneWithDecryption(em, 'Entity', filter, { tenantId, organizationId })
```

## Boolean Parsing

For env vars and query params, never use `=== 'true'`:

```typescript
const isEnabled = parseBooleanToken(process.env.MY_FLAG) // true | false | undefined
const withDefault = parseBooleanWithDefault(query.active, true) // defaults to true
```

## Safe Entity Flush

When a command mutates entities across phases that include queries on the same `EntityManager`, use `withAtomicFlush` to prevent silent data loss:

```typescript
import { withAtomicFlush } from '@helios/shared/lib/commands/flush'

await withAtomicFlush(em, [
  () => { record.name = 'New'; record.status = 'active' },
  () => syncEntityTags(em, record, tags), // internal em.find() won't lose changes
], { transaction: true })

// Side effects AFTER the atomic flush
await emitCrudSideEffects({ ... })
```

**Never** run `em.find`/`em.findOne` between scalar mutations and `em.flush()` without `withAtomicFlush`.

## CRUD Multi-ID Filtering

Filter list APIs by multiple IDs using `?ids=uuid1,uuid2`:

```typescript
import { parseIdsParam, mergeIdFilter } from '@helios/shared/lib/crud/ids'
const ids = parseIdsParam(query.ids) // string[] | undefined
const filter = mergeIdFilter(existingFilter, ids) // intersects with existing id filter
```

## Custom Field Helpers

When your entity uses custom fields:

```typescript
import { splitCustomFieldPayload, normalizeCustomFieldValues, normalizeCustomFieldResponse }
  from '@helios/shared/lib/custom-fields'

// In create/update: split cf:* fields from standard fields
const { standard, custom } = splitCustomFieldPayload(body)

// Normalize for storage
const normalized = normalizeCustomFieldValues(custom, fieldDefinitions)

// Normalize for API response
const response = normalizeCustomFieldResponse(record, customFields)
```
