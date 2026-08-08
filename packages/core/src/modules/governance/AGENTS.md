# Governance Module — Agent Guidelines

Customer identity mappings and governance findings (Helios Flow M7). Spec: `.ai/specs/2026-08-08-insights-kpi-and-governance.md` (governance sections).

## Always

- Scope every query and command by `tenantId` / `organizationId`.
- Expose `updatedAt` on list/detail responses for optimistic locking.
- Run built-in detectors via `lib/rules/` and `governance.rules.run` — idempotent upsert by `(ruleId, subjectType, subjectId, asOf)`.
- Keep customer dedupe as mapping only — source `customer_entities` rows MUST remain.

## Ask First

- Ask before applying `yarn db:migrate`.

## Never

- Never hard-delete identity maps or findings — soft-delete via `deletedAt`.
- Never delete or merge-delete customer entities from governance commands.
- Never declare ORM relations to `customers`, `projects`, or `commercial` entities — UUID reads only.

## Validation Commands

```bash
yarn generate
yarn workspace @helios/core test -- governance
yarn workspace @helios/core build
```

## Key paths

| Path | Role |
|------|------|
| `data/entities.ts` | `CustomerIdentityMap`, `GovernanceFinding` |
| `api/identity-maps/route.ts` | Identity map CRUD |
| `api/findings/route.ts` | Finding CRUD + status |
| `api/rules/run/route.ts` | Rule pack runner |
| `lib/rules/` | Built-in detectors |
| `backend/governance/` | Admin UI |
