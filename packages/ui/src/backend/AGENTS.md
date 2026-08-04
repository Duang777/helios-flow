# Backend UI — Agent Guidelines

Use `@helios/ui/backend` for all admin/backend page components. See `packages/ui/AGENTS.md` for full UI patterns.

## Always

1. **MUST set stable `id` values on `RowActions` items** — use `edit`, `open`, `delete`, etc. DataTable resolves default row-click behavior from these ids
2. **MUST use `apiCall`/`apiCallOrThrow`** from `@helios/ui/backend/utils/apiCall` — never use raw `fetch`
3. **MUST use `LoadingMessage`/`ErrorMessage`** from `@helios/ui/backend/detail` for loading and error states
4. **MUST use `useT()`** for all labels and messages
5. **MUST use `useGuardedMutation` when not using `CrudForm`** — wrap every write operation (`POST`/`PUT`/`PATCH`/`DELETE`) in `runMutation({ operation, context, mutationPayload })` so global mutation injections (record locks, conflict UI, future guards) run consistently
6. **MUST use `Button` or `IconButton`** for every interactive button. Use `IconButton` for icon-only buttons, `Button` for everything else. Always pass `type="button"` explicitly on non-submit buttons. See `packages/ui/AGENTS.md` → Button and IconButton Usage for full patterns and variant reference.
7. **MUST treat missing records as a dedicated page-level state** — distinguish `notFound` from generic `error`, return early, and render a shared `ErrorMessage`-based state with a clear recovery action (for example, back to the owning list page).

## Ask First

- Ask before changing DataTable row-click defaults, UMES host surface IDs, CrudForm event behavior, or replacement handles.
- Ask before introducing backend-page write flows that do not fit `CrudForm` or `useGuardedMutation`.

## Never

- Never use raw `fetch` from backend UI components.
- Never hard-code user-facing strings.
- Never use raw `<button>` elements.
- Never render `CrudForm`, detail sections, tabs, or record actions when the record is missing.

## Validation Commands

```bash
yarn workspace @helios/ui test
yarn workspace @helios/ui build
```

## DataTable Row-Click Behavior

Customize which action ids trigger row clicks via the `rowClickActionIds` prop (defaults to `['edit', 'open']`).

```typescript
<DataTable
  rowClickActionIds={['edit', 'open']}  // Default — clicks trigger edit or open action
  // ...
/>
```

## Key Imports

```typescript
import { Button } from '@helios/ui/primitives/button'
import { IconButton } from '@helios/ui/primitives/icon-button'
import { apiCall, apiCallOrThrow } from '@helios/ui/backend/utils/apiCall'
import { CrudForm, createCrud, updateCrud, deleteCrud } from '@helios/ui/backend/crud'
import { LoadingMessage, ErrorMessage } from '@helios/ui/backend/detail'
import { FormHeader, FormFooter } from '@helios/ui/backend/forms'
import { flash } from '@helios/ui/backend/FlashMessages'
import { createCrudFormError } from '@helios/ui/backend/utils/serverErrors'
import { useGuardedMutation } from '@helios/ui/backend/injection/useGuardedMutation'
import { useInjectionDataWidgets } from '@helios/ui/backend/injection/useInjectionDataWidgets'
import { useInjectedMenuItems } from '@helios/ui/backend/injection/useInjectedMenuItems'
import { mergeMenuItems } from '@helios/ui/backend/injection/mergeMenuItems'
import { useRegisteredComponent } from '@helios/ui/backend/injection/useRegisteredComponent'
```

## Widget Event Hooks

### useAppEvent

Subscribe to server-side events bridged to the browser via the DOM Event Bridge:

```typescript
import { useAppEvent } from '@helios/ui/backend/injection/useAppEvent'

// Supports wildcards: 'module.*', 'module.entity.*', '*'
useAppEvent('example.todo.*', (event) => {
  // event.id, event.payload, event.timestamp, event.organizationId
}, [dependencies])
```

### useOperationProgress

Track long-running async operations:

```typescript
import { useOperationProgress } from '@helios/ui/backend/injection/useOperationProgress'

const progress = useOperationProgress('mymod.import.*')
// progress.status: 'idle' | 'running' | 'completed' | 'failed'
// progress.progress: 0-100
// progress.processedCount, progress.totalCount
// progress.currentStep, progress.errors, progress.elapsedMs
```

### Widget Event Handlers (Phase C)

Widgets can declare additional event handlers beyond the original CRUD lifecycle:

| Handler | Type | Description |
|---------|------|-------------|
| `onFieldChange` | Action | Called when a specific form field changes |
| `onBeforeNavigate` | Action | Called before navigation; return `{ ok: false }` to block |
| `onVisibilityChange` | Action | Called when widget visibility changes |
| `onAppEvent` | Action | Called when a matching DOM Event Bridge event arrives |
| `transformFormData` | Transformer | Pipeline: modify form data before save |
| `transformDisplayData` | Transformer | Pipeline: modify data before display |
| `transformValidation` | Transformer | Pipeline: modify validation results |

Action events fire independently; transformer events form a pipeline where each widget's output feeds the next.

CrudForm emits these extended handlers by default. Disable automatic emission with `NEXT_PUBLIC_HELIOS_CRUDFORM_EXTENDED_EVENTS_ENABLED=false`.

## UMES Host Surfaces (Phases F/G/H)

- DataTable hosts should use stable `extensionTableId` values so injection spots (`columns`, `row-actions`, `bulk-actions`, `filters`) remain backward-compatible.
- CrudForm hosts should use stable `entityId` and field/group IDs so `crud-form:<entityId>:fields` injections can target predictable surfaces.
- For replacement-aware surfaces, resolve components by handle using `useRegisteredComponent(handle, Fallback)` and keep handle IDs stable.

## When Building Backend Pages

- Use `CrudForm` for create/edit flows — see `packages/ui/AGENTS.md` → CrudForm Guidelines
- Use `DataTable` for list views — see `packages/ui/AGENTS.md` → DataTable Guidelines
- Use `FormHeader` with mode `edit` (compact) or `detail` (large title with status)
- For record-backed `[id]` pages, prefer `loading -> notFound -> error -> ready` state flow over `if (error || !data)` shortcuts.
- Follow the customers module as the reference implementation
