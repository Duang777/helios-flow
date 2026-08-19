# UI Package Guidelines

Compact rule index for `@helios/ui`. Long-form historical guidance moved to
`../../.ai/docs/agent-guides/ui-agents-guidelines.md`.

Before building UI, read `.ai/ds-rules.md`, `.ai/ui-components.md`, and, for
backend page families, `.ai/ui-backend-components.md`.

## Always

- Reuse existing primitives and backend component families before creating new UI.
- Use `CrudForm` for create/edit flows and dialog forms unless the host truly
  requires custom handling.
- Use `DataTable` as the default list view, including portal list pages.
- Use `apiCall` / `apiCallOrThrow` / `readApiResultOrThrow` for backend and
  portal data calls.
- Use `useGuardedMutation` for every write that cannot use `CrudForm`.
- Use i18n keys and `useT()` / `resolveTranslations()` for user-facing copy.
- Keep UMES spot ids, replacement handles, field/group ids, portal page metadata,
  and component contracts stable.
- Follow design-system tokens for color, spacing, radius, type, state, and
  status styling.

## Ask First

- Ask before changing primitive APIs, DataTable/CrudForm contracts, portal shell
  behavior, frozen portal spots, or replacement handles.
- Ask before creating a new primitive or backend component when an existing one
  might fit.
- Ask before changing default interaction patterns for dialogs, bulk actions,
  row clicks, keyboard shortcuts, or portal navigation.

## Never

- Never use raw `<button>`, raw checkbox inputs, or raw `<Link>` styled as a button.
- Never use raw `fetch` in UI data flows where `apiCall` is available.
- Never hard-code user-facing strings.
- Never use `window.confirm`; use the shared confirmation dialog.
- Never add custom per-page progress bars for DataTable bulk work.
- Never omit `page.meta.ts` for guarded portal pages.
- Never check wildcard feature grants with `includes(...)` or `Set.has(...)`.
- Never hard-code status colors, arbitrary Tailwind values, or hex/rgb colors in
  `className`.

## Validation Commands

```bash
yarn workspace @helios/ui test
yarn workspace @helios/ui build
yarn i18n:check
yarn agents:check-budget
```

## Primitive Quick Rules

- Text button: `Button` from `@helios/ui/primitives/button`.
- Icon-only button: `IconButton` from `@helios/ui/primitives/icon-button`.
- Link button: `Button asChild`, `IconButton asChild`, or `LinkButton`.
- Checkbox: `Checkbox` / `CheckboxField`; never raw native checkboxes in new code.
- Inputs/selects/switches/radios/sliders/color pickers: use existing primitives
  listed in `.ai/ui-components.md`.
- Tooltips: use `SimpleTooltip` or `Tooltip` primitives.
- Avatar/tag/keyboard shortcut/breadcrumb/progress/etc.: use package primitives,
  not ad hoc divs/spans.
- Always pass `type="button"` on non-submit button primitives.
- Same-row buttons should share `size`.

## CrudForm

- Use `CrudForm` with shared field/group builders and Zod validation.
- Use `createCrud`, `updateCrud`, `deleteCrud` and `flash()` for CRUD submits.
- Validation messages may be i18n keys; if manually mapping Zod issues, translate
  before `createCrudFormError`.
- Pass `entityIds` when custom fields are involved.
- Edit-mode `initialValues` must include `updatedAt`; `CrudForm` automatically
  derives optimistic-lock headers for submit and delete.
- Do not also wrap `updateCrud`/`deleteCrud` in custom optimistic-lock headers
  when `CrudForm` is already supplying them.

## DataTable

- Use `DataTable` for list surfaces and bulk actions.
- Keep `pageSize <= 100`.
- Prefer column `meta.truncate` / `meta.maxWidth` for truncation.
- Row actions need stable ids.
- Use shared loading/error/empty states.
- Bulk mutations should use existing progress/job patterns; do not create local
  progress bars.
- Portal DataTables must use portal-safe API calls and portal auth features.

## Dialogs And Interaction

- Every new dialog supports `Cmd/Ctrl+Enter` submit and `Escape` cancel.
- Use shared `ConfirmDialog` / `useConfirmDialog`.
- Use `EventSelect` from `@helios/ui/backend/inputs/EventSelect` for event selection.
- Form/detail headers and footers should use `FormHeader` / `FormFooter`.

## Portal Extension

- Portal pages live under `frontend/[orgSlug]/portal/...` and require metadata:
  `requireCustomerAuth` and `requireCustomerFeatures`.
- Use portal hooks from `packages/ui/src/portal/hooks/`.
- Keep portal menu spots, widget injection spots, component replacement handles,
  and page metadata contracts frozen once shipped.
- Portal sidebar entries come from metadata `nav` or portal menu injection, not
  ad hoc shell edits.
- Portal event bridge must preserve tenant/org/customer account scoping.

## Component Replacement And Injection

- Use widget injection/replacement contracts rather than direct cross-module UI
  imports when extending another module.
- Keep replacement handles and injection spot ids stable.
- If a backend page cannot use `CrudForm`, wrap writes with
  `useGuardedMutation(...).runMutation(...)` and pass `retryLastMutation` to the
  injection context.

## Design System

- Use semantic/status tokens; do not add `dark:` overrides for tokens that already
  handle dark mode.
- Use existing spacing/type/radius scales; avoid arbitrary values.
- Use lucide icons inside buttons when available.
- Do not put cards inside cards; use cards only for repeated items, modals, and
  genuinely framed tools.
- Ensure text fits in its container across mobile and desktop.

## Reference Modules

- Customers: backend people list/create/detail task form.
- Sales: document tables, payments section, document form.
- Auth/staff: users and roles list/create pages.
- Backend component inventory: `.ai/ui-backend-components.md`.
