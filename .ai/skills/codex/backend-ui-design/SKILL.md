---
name: backend-ui-design-codex
description: Internal Codex-flavored copy of the backend UI design guidance for `@helios/ui`. Prefer the main `helios-backend-ui-design` skill for normal backend page, CRUD, table, and form work.
metadata:
  short-description: Backend UI design using @helios/ui
  author: Helios
  version: 1.0.0
  tags:
    - ui
    - backend
    - admin
    - crud
    - forms
    - tables
---

This skill guides creation of consistent, production-grade backend/backoffice interfaces using the established @helios/ui component library. All implementations must leverage existing components to maintain visual and behavioral consistency across modules.

For complete component documentation, see `references/ui-components.md`. Pair this skill with `packages/ui/AGENTS.md` and `packages/ui/src/backend/AGENTS.md` for the current design-system and backend-host rules.

## Design Principles

Backend UI prioritizes **usability, consistency, and productivity** over creative expression:

1. **Consistency First**: Every page should feel like part of the same application. Use established patterns.
2. **Component Reuse**: Never create custom implementations when a shared component exists.
3. **Data Density**: Admin users need information-rich interfaces. Optimize for scanning and quick actions.
4. **Keyboard Navigation**: Support Cmd/Ctrl+Enter for primary actions, Escape to cancel, and standard shortcuts.
5. **Clear Hierarchy**: Page → Section → Content. Use PageHeader, PageBody, and consistent spacing.
6. **Design System Discipline**: Use semantic status tokens and the shared backend primitives (`StatusBadge`, `Alert`, `FormField`, `SectionHeader`, `CollapsibleSection`, `EmptyState`). No hardcoded status colors or arbitrary text sizes.

## Required Component Library

ALWAYS import from `@helios/ui`. Reference the component documentation at `.ai/specs/SPEC-001-2026-01-21-ui-reusable-components.md`.

### Core Layout Pattern

```tsx
import { Page, PageHeader, PageBody } from '@helios/ui/backend/Page'
import { AppShell } from '@helios/ui/backend/AppShell'

// Every backend page follows this structure
<Page>
  <PageHeader>
    {/* Title, actions, breadcrumbs */}
  </PageHeader>
  <PageBody>
    {/* Main content */}
  </PageBody>
</Page>
```

### Data Display (Lists)

Use `DataTable` for ALL tabular data. Never implement custom tables.

```tsx
import { DataTable } from '@helios/ui/backend/DataTable'
import type { FilterDef } from '@helios/ui/backend/FilterBar'
import { RowActions } from '@helios/ui/backend/RowActions'
import { TruncatedCell } from '@helios/ui/backend/TruncatedCell'
import { BooleanIcon, EnumBadge } from '@helios/ui/backend/ValueIcons'
```

Column configuration patterns:
- Text columns: Use `TruncatedCell` with `meta.maxWidth` for long content
- Boolean columns: Use `BooleanIcon`
- Status/enum columns: Use `EnumBadge` with severity presets
- Actions column: Use `RowActions` for context menus

### Forms

Use `CrudForm` for ALL forms. Never build forms from scratch.

```tsx
import { CrudForm, type CrudField, type CrudFormGroup } from '@helios/ui/backend/CrudForm'
import { JsonBuilder } from '@helios/ui/backend/JsonBuilder'
```

Form field types available:
- `text`, `textarea`, `number`, `email`, `password`
- `select`, `multiselect`, `combobox`
- `checkbox`, `switch`
- `date`, `datetime`
- `custom` (for JsonBuilder, TagsInput, etc.)

### Dialogs

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@helios/ui/primitives/dialog'
import { CrudForm } from '@helios/ui/backend/CrudForm'

// Dialog forms MUST use embedded={true}
<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="sm:max-w-2xl [&_.grid]:!grid-cols-1">
    <DialogHeader>
      <DialogTitle>Edit Item</DialogTitle>
    </DialogHeader>
    <CrudForm
      fields={fields}
      groups={groups}
      initialValues={initialValues}
      onSubmit={handleSubmit}
      embedded={true}
      submitLabel="Save"
    />
  </DialogContent>
</Dialog>
```

### Detail Pages

```tsx
import {
  DetailFieldsSection,
  LoadingMessage,
  ErrorMessage,
  TabEmptyState
} from '@helios/ui/backend/detail'
import { NotesSection } from '@helios/ui/backend/detail/NotesSection'
import { TagsSection } from '@helios/ui/backend/detail/TagsSection'
import { CustomDataSection } from '@helios/ui/backend/detail/CustomDataSection'
```

### Notifications

```tsx
import { flash } from '@helios/ui/backend/FlashMessages'

// Success
flash('Record saved successfully', 'success')

// Error
flash('Failed to save record', 'error')

// Warning/Info
flash('This action cannot be undone', 'warning')
flash('Processing in background', 'info')
```

NEVER use `alert()`, `console.log()`, or custom toast implementations.

### Loading & Error States

```tsx
import { Spinner } from '@helios/ui/primitives/spinner'
import { DataLoader } from '@helios/ui/primitives/DataLoader'
import { ErrorNotice } from '@helios/ui/primitives/ErrorNotice'
import { EmptyState } from '@helios/ui/backend/EmptyState'
import { LoadingMessage, ErrorMessage } from '@helios/ui/backend/detail'
```

### Primitives (use sparingly, prefer backend components)

```tsx
import { Button } from '@helios/ui/primitives/button'
import { Input } from '@helios/ui/primitives/input'
import { Label } from '@helios/ui/primitives/label'
import { Badge } from '@helios/ui/primitives/badge'
import { Alert, AlertTitle, AlertDescription } from '@helios/ui/primitives/alert'
import { Separator } from '@helios/ui/primitives/separator'
import { Switch } from '@helios/ui/primitives/switch'
import { SimpleTooltip } from '@helios/ui/primitives/tooltip'
```

## Implementation Checklist

Before writing any backend UI code, verify:

- [ ] Using `CrudForm` for forms (not custom form implementations)
- [ ] Using `DataTable` for lists (not custom tables)
- [ ] Using `flash()` for notifications (not alert/toast)
- [ ] Dialog forms have `embedded={true}`
- [ ] Keyboard shortcuts: Cmd/Ctrl+Enter (submit), Escape (cancel)
- [ ] Loading states use `LoadingMessage` or `DataLoader`
- [ ] Error states use `ErrorMessage` or `ErrorNotice`
- [ ] Empty states use `EmptyState`
- [ ] Column truncation configured with `meta.truncate` and `meta.maxWidth`
- [ ] Boolean values use `BooleanIcon`
- [ ] Status/enum values use `EnumBadge`
- [ ] Row actions use `RowActions` component

## Visual Guidelines

### Spacing
- Use consistent padding: `p-4` for cards, `p-6` for page sections
- Use `gap-4` or `gap-6` for flex/grid layouts
- Maintain vertical rhythm with `space-y-4` or `space-y-6`

### Colors
- Use semantic colors from the theme (don't hardcode hex values)
- Destructive actions: `variant="destructive"` on buttons
- Status badges: Use `useSeverityPreset()` for consistent coloring

### Typography
- Page titles: Handled by `PageHeader`
- Section titles: `text-lg font-semibold`
- Labels: Handled by form components
- Body text: Default sizing, avoid custom font sizes

### Layout Patterns
- List pages: FilterBar + DataTable + Pagination
- Detail pages: Header + Tabs or Sections + Related data
- Create/Edit: Full-page CrudForm or Dialog with embedded CrudForm
- Settings: Grouped sections with inline editing

## Anti-Patterns to Avoid

1. **Custom form implementations** - Always use CrudForm
2. **Manual table markup** - Always use DataTable
3. **Custom toast/notification** - Always use flash()
4. **Inline styles** - Use Tailwind classes
5. **Hardcoded colors** - Use theme variables
6. **Missing loading states** - Every async operation needs feedback
7. **Missing error handling** - Every failure needs user-friendly messaging
8. **Missing keyboard shortcuts** - All dialogs need Cmd+Enter and Escape
9. **Custom truncation logic** - Use TruncatedCell with meta.maxWidth
10. **Direct fetch() calls** - Use apiCall/apiCallOrThrow from utils

## API Integration Pattern

```tsx
import { apiCall, apiCallOrThrow } from '@helios/ui/backend/utils/apiCall'
import { createCrud, updateCrud, deleteCrud } from '@helios/ui/backend/utils/crud'
import { mapCrudServerErrorToFormErrors, createCrudFormError } from '@helios/ui/backend/utils/serverErrors'

// For CRUD operations
const handleCreate = async (values: FormValues) => {
  const result = await createCrud<ResponseType>('module/resource', values)
  if (result.ok) {
    flash('Created successfully', 'success')
    router.push(`/backend/module/${result.result.id}`)
  }
  return result
}

// For custom endpoints
const result = await apiCall<ResponseType>('/api/custom-endpoint', {
  method: 'POST',
  body: JSON.stringify(data)
})
```

## Custom Fields Integration

When building CRUD interfaces that support custom fields:

```tsx
import { useCustomFieldDefinitions } from '@helios/ui/backend/utils/customFieldDefs'
import { buildCustomFieldFormFields } from '@helios/ui/backend/utils/customFieldForms'
import { buildCustomFieldColumns } from '@helios/ui/backend/utils/customFieldColumns'
import { collectCustomFieldValues } from '@helios/ui/backend/utils/customFieldValues'
```

## When to Create New Components

Only create new components when:
1. No existing component serves the use case
2. The pattern will be reused across 3+ modules
3. Approved for addition to `@helios/ui`

If creating something new, it should eventually be added to the shared library, not kept in a single module.
