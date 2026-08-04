# UI Components Reference

Complete reference of all available UI components in `@helios/ui`.

## Package Structure

```
@helios/ui/
├── primitives/          # Base UI components (shadcn-style)
├── backend/             # Full-featured admin components
├── frontend/            # Public-facing components
└── theme/               # Theme and provider setup
```

## PRIMITIVES (`@helios/ui/primitives/*`)

| Component | Import Path | Purpose |
|-----------|-------------|---------|
| **Button** | `@helios/ui/primitives/button` | Core button with variants (default, outline, ghost, destructive) |
| **Input** | `@helios/ui/primitives/input` | Text input field |
| **Label** | `@helios/ui/primitives/label` | Form label component |
| **Textarea** | `@helios/ui/primitives/textarea` | Multi-line text input |
| **Dialog** | `@helios/ui/primitives/dialog` | Modal dialog (Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter) |
| **Tooltip** | `@helios/ui/primitives/tooltip` | Hover tooltip + `SimpleTooltip` utility component |
| **Table** | `@helios/ui/primitives/table` | Table structure (Table, TableHeader, TableBody, TableRow, TableHead, TableCell) |
| **Alert** | `@helios/ui/primitives/alert` | Alert boxes (Alert, AlertTitle, AlertDescription) with variants |
| **Badge** | `@helios/ui/primitives/badge` | Small badge/tag labels with variants |
| **Separator** | `@helios/ui/primitives/separator` | Visual divider line |
| **Switch** | `@helios/ui/primitives/switch` | Toggle switch control |
| **Spinner** | `@helios/ui/primitives/spinner` | Loading spinner animation |
| **ErrorNotice** | `@helios/ui/primitives/ErrorNotice` | Error message display with icon |
| **DataLoader** | `@helios/ui/primitives/DataLoader` | Loading state wrapper with spinner and optional skeleton |

## BACKEND COMPONENTS (`@helios/ui/backend/*`)

### Core Layout & Navigation

| Component | Import Path | Purpose | Key Props |
|-----------|-------------|---------|-----------|
| **AppShell** | `@helios/ui/backend/AppShell` | Main application shell with sidebar, header, breadcrumbs | `navigation`, `user`, `children` |
| **Page, PageHeader, PageBody** | `@helios/ui/backend/Page` | Page layout containers | - |
| **UserMenu** | `@helios/ui/backend/UserMenu` | User profile dropdown with logout | `user`, `onLogout` |
| **FlashMessages, flash** | `@helios/ui/backend/FlashMessages` | Toast notifications. Use `flash(message, type)` programmatically | Type: 'success' \| 'error' \| 'warning' \| 'info' |

### Data Display & Tables

| Component | Import Path | Purpose | Key Props |
|-----------|-------------|---------|-----------|
| **DataTable** | `@helios/ui/backend/DataTable` | Feature-rich table with sorting, filtering, pagination, export, perspectives | `entityId`, `apiPath`, `extensionTableId`, `columns`, `data`, `page`, `pageSize`, `totalCount`, `onPageChange`, `onRowClick` |
| **TruncatedCell** | `@helios/ui/backend/TruncatedCell` | Table cell with text truncation and tooltip | `value`, `maxWidth` |
| **EmptyState** | `@helios/ui/backend/EmptyState` | Empty state placeholder | `title`, `description`, `action`, `icon` |
| **RowActions** | `@helios/ui/backend/RowActions` | Context menu for row actions | `items: {label, href?, onSelect?, destructive?}[]` |
| **FilterBar** | `@helios/ui/backend/FilterBar` | Search and filter UI bar | `filters`, `values`, `onApply`, `onClear` |
| **ValueIcons** | `@helios/ui/backend/ValueIcons` | `BooleanIcon`, `EnumBadge`, `useSeverityPreset()` | - |

### Forms

| Component | Import Path | Purpose | Key Props |
|-----------|-------------|---------|-----------|
| **CrudForm** | `@helios/ui/backend/CrudForm` | Complete CRUD form with field registry, groups, custom fields, validation | `fields`, `groups`, `initialValues`, `onSubmit`, `schema`, `embedded`, `extraActions` |
| **JsonBuilder** | `@helios/ui/backend/JsonBuilder` | Interactive JSON editor with "Raw JSON" and "Builder" tabs | `value`, `onChange`, `disabled` |
| **JsonDisplay** | `@helios/ui/backend/JsonDisplay` | Read-only JSON viewer with expand/collapse | `data`, `title`, `maxInitialDepth`, `showCopy` |

### Input Components (`@helios/ui/backend/inputs/*`)

| Component | Import Path | Purpose | Key Props |
|-----------|-------------|---------|-----------|
| **TagsInput** | `@helios/ui/backend/inputs/TagsInput` | Multi-tag input with suggestions | `value`, `onChange`, `placeholder`, `suggestions` |
| **ComboboxInput** | `@helios/ui/backend/inputs/ComboboxInput` | Searchable dropdown (single value) | `value`, `onChange`, `options`, `placeholder` |
| **PhoneNumberField** | `@helios/ui/backend/inputs/PhoneNumberField` | Phone input with formatting | `value`, `onChange`, `checkDuplicate` |
| **LookupSelect** | `@helios/ui/backend/inputs/LookupSelect` | Async lookup/search select | `value`, `onChange`, `onSearch`, `renderItem` |
| **SwitchableMarkdownInput** | `@helios/ui/backend/inputs/SwitchableMarkdownInput` | Text/markdown toggle input | `value`, `onChange`, `placeholder` |

### Detail Page Components (`@helios/ui/backend/detail/*`)

| Component | Import Path | Purpose | Key Props |
|-----------|-------------|---------|-----------|
| **DetailFieldsSection** | `@helios/ui/backend/detail/DetailFieldsSection` | Entity field display with inline editing | `fields`, `entity`, `onUpdate` |
| **InlineTextEditor** | `@helios/ui/backend/detail/InlineEditors` | Click-to-edit text field | `value`, `onSave`, `label` |
| **InlineMultilineEditor** | `@helios/ui/backend/detail/InlineEditors` | Click-to-edit textarea | `value`, `onSave`, `label` |
| **InlineSelectEditor** | `@helios/ui/backend/detail/InlineEditors` | Click-to-edit select | `value`, `onSave`, `options`, `label` |
| **NotesSection** | `@helios/ui/backend/detail/NotesSection` | Notes/comments section with markdown | `notes`, `onAdd`, `onUpdate`, `onDelete` |
| **TagsSection** | `@helios/ui/backend/detail/TagsSection` | Tag management section | `tags`, `onAdd`, `onRemove`, `suggestions` |
| **CustomDataSection** | `@helios/ui/backend/detail/CustomDataSection` | Custom fields display | `data`, `fieldDefinitions` |
| **LoadingMessage** | `@helios/ui/backend/detail` | Loading state with spinner | `message` |
| **ErrorMessage** | `@helios/ui/backend/detail` | Error alert with action | `title`, `description`, `action` |
| **TabEmptyState** | `@helios/ui/backend/detail` | Empty state for tabs | `message`, `action` |

## BACKEND UTILITIES (`@helios/ui/backend/utils/*`)

| Utility | Import Path | Purpose | Key Exports |
|---------|-------------|---------|-------------|
| **apiCall** | `@helios/ui/backend/utils/apiCall` | HTTP client with auth | `apiCall`, `apiCallOrThrow`, `readApiResultOrThrow` |
| **api** | `@helios/ui/backend/utils/api` | Low-level API utils | `apiFetch` |
| **crud** | `@helios/ui/backend/utils/crud` | CRUD operation helpers | `createCrud`, `updateCrud`, `deleteCrud` |
| **serverErrors** | `@helios/ui/backend/utils/serverErrors` | Error mapping | `mapCrudServerErrorToFormErrors`, `createCrudFormError`, `raiseCrudError` |
| **customFieldValues** | `@helios/ui/backend/utils/customFieldValues` | Custom field value helpers | `collectCustomFieldValues`, `normalizeCustomFieldSubmitValue` |
| **customFieldDefs** | `@helios/ui/backend/utils/customFieldDefs` | Field definition fetching | `useCustomFieldDefinitions` |
| **customFieldForms** | `@helios/ui/backend/utils/customFieldForms` | Form field generation | `buildCustomFieldFormFields` |
| **customFieldColumns** | `@helios/ui/backend/utils/customFieldColumns` | Column builders | `buildCustomFieldColumns` |
| **customFieldFilters** | `@helios/ui/backend/utils/customFieldFilters` | Filter definitions | `useCustomFieldFilters` |

## Common Usage Patterns

### Flash Messages
```tsx
import { flash } from '@helios/ui/backend/FlashMessages'

flash('Record saved successfully', 'success')
flash('Failed to save record', 'error')
// Types: 'success' | 'error' | 'warning' | 'info'
```

### DataTable with Filters
```tsx
import { DataTable } from '@helios/ui/backend/DataTable'
import type { FilterDef, FilterValues } from '@helios/ui/backend/FilterBar'

const filters: FilterDef[] = [
  { id: 'search', type: 'text', label: 'Search', placeholder: 'Search...' },
  { id: 'status', type: 'select', label: 'Status', options: [...] },
]

<DataTable
  entityId="inventory.item"
  apiPath="inventory/items"
  extensionTableId="inventory.item"
  columns={columns}
  filters={filters}
  filterValues={filterValues}
  onFiltersApply={handleFiltersApply}
  onFiltersClear={handleFiltersClear}
  page={page}
  pageSize={pageSize}
  totalCount={totalCount}
  onPageChange={setPage}
  onRowClick={(row) => router.push(`/items/${row.id}`)}
/>
```

### CrudForm
```tsx
import { CrudForm, type CrudField, type CrudFormGroup } from '@helios/ui/backend/CrudForm'

const fields: CrudField[] = [
  { id: 'name', label: 'Name', type: 'text', required: true },
  { id: 'description', label: 'Description', type: 'textarea' },
  { id: 'status', label: 'Status', type: 'select', options: [...] },
  { id: 'config', label: 'Config', type: 'custom', component: (props) => <JsonBuilder {...props} /> },
]

const groups: CrudFormGroup[] = [
  { id: 'basic', title: 'Basic Info', column: 1, fields: ['name', 'description'] },
  { id: 'settings', title: 'Settings', column: 1, fields: ['status', 'config'] },
]

<CrudForm
  title="Create Item"
  fields={fields}
  groups={groups}
  initialValues={{}}
  onSubmit={handleSubmit}
  submitLabel="Save"
  embedded={true}  // For use inside dialogs
  extraActions={<Button onClick={handleDelete}>Delete</Button>}
/>
```

### Dialog with Form
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@helios/ui/primitives/dialog'
import { CrudForm } from '@helios/ui/backend/CrudForm'

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

### Detail Page with Inline Editing
```tsx
import { DetailFieldsSection, LoadingMessage, ErrorMessage } from '@helios/ui/backend/detail'

if (isLoading) return <LoadingMessage message="Loading..." />
if (error) return <ErrorMessage title="Error" description={error.message} />

<DetailFieldsSection
  fields={[
    { id: 'name', label: 'Name', type: 'text' },
    { id: 'status', label: 'Status', type: 'select', options: [...] },
  ]}
  entity={entity}
  onUpdate={handleUpdate}
/>
```

### API Calls
```tsx
import { apiCall } from '@helios/ui/backend/utils/apiCall'
import { createCrud, updateCrud, deleteCrud } from '@helios/ui/backend/utils/crud'

// Generic API call
const result = await apiCall<ResponseType>('/api/endpoint', { method: 'POST', body: JSON.stringify(data) })
if (result.ok) {
  // result.result contains the parsed JSON response
}

// CRUD operations
const created = await createCrud<ItemType>('module/items', payload)
const updated = await updateCrud<ItemType>('module/items', id, payload)
const deleted = await deleteCrud('module/items', id)
```

## Important Notes

1. **Always use `flash()` for notifications** - Don't use `alert()` or custom toast implementations
2. **Use `CrudForm` for forms** - Provides consistent validation, field rendering, and keyboard shortcuts
3. **Use `DataTable` for lists** - Includes filtering, sorting, pagination, export, and perspectives
4. **Keep `extensionTableId` stable** - Injection spots must remain backward-compatible
5. **Use `JsonBuilder` for JSON editing** - Provides both raw JSON and visual builder modes
6. **Dialog forms need `embedded={true}`** - And add `[&_.grid]:!grid-cols-1` to DialogContent for single-column layout
7. **Support Cmd/Ctrl+Enter and Escape** - All dialogs should support these keyboard shortcuts
