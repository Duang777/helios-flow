# Insights Module — Agent Guidelines

KPI targets and completion analytics (Helios Flow M7). Spec: `.ai/specs/2026-08-08-insights-kpi-and-governance.md` (insights sections only).

## Always

- Scope every query and command by `tenantId` / `organizationId`.
- Expose `updatedAt` on list/detail responses for optimistic locking.
- Compute completion actuals via `lib/completion.ts` using `commercial/lib/metrics` — never fork formulas in UI.
- Company rollup = derived sum of child org rows (`lib/rollup.ts` + directory `Organization.descendantIds`).
- Store ratio targets as 0–100 (percent) to match deal probability style.

## Ask First

- Ask before applying `yarn db:migrate`.

## Never

- Never hard-delete KPI targets — soft-delete via `deletedAt`.
- Never store free-typed actual overrides (KPI-02).
- Never declare ORM relations to `commercial` or `directory` entities — UUID reads only.

## Validation Commands

```bash
yarn generate
yarn workspace @helios/core test -- completion
yarn workspace @helios/core test -- rollup
yarn workspace @helios/core build
```

## Key paths

| Path | Role |
|------|------|
| `data/entities.ts` | `KpiTarget` |
| `api/kpi-targets/route.ts` | CRUD |
| `api/kpi/completion/route.ts` | Completion board API |
| `lib/completion.ts` | Actuals + completion rate |
| `lib/rollup.ts` | Org hierarchy rollup |
| `backend/insights/` | Admin UI |
