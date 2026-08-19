# Commercial Module — Agent Guidelines

Operating settlement (not GL): contracts, project revenue/cost facts, invoices, payments, allocations. Spec: `.ai/specs/2026-08-08-commercial-settlement-module.md`.

## Always

- Keep cross-module links as UUID fields only (`projectId`, `customerEntityId`, `dealId`) — never ORM relations.
- Scope every query and command by `tenantId` / `organizationId`.
- Expose `updatedAt` on list/detail responses for optimistic locking.
- Use command pattern for create/update/delete under `commands/`.
- Compute §7.9 metrics via `lib/metrics.ts` only — UI and API must not fork formulas.
- Enforce allocation guards on write: Σ alloc ≤ invoice amount and ≤ payment amount (same tenant/org).

## Ask First

- Ask before applying `yarn db:migrate`.
- Ask before adding GL / chart-of-accounts entities (out of Flow scope).

## Never

- Never hard-delete commercial facts — soft-delete via `deletedAt`.
- Never use Σ payment amount alone for collection rate — allocations only.

## Validation Commands

```bash
yarn generate
yarn workspace @helios/core test -- metrics
yarn workspace @helios/core build
```

## Key paths

| Path | Role |
|------|------|
| `data/entities.ts` | Six fact tables |
| `api/*/route.ts` | CRUD + metrics |
| `lib/metrics.ts` | PRD §7.9 pure formulas |
| `lib/allocationGuards.ts` | Over-allocation checks |
| `backend/commercial/*/` | Admin UI |
| `ai-tools.ts` / `ai-agents.ts` | Read-only assistant |
