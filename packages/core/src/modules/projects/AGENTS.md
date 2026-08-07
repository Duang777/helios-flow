# Projects Module — Agent Guidelines

Delivery projects, milestones, and project risks for Helios Flow M5 (sales-to-cash loop). Spec: `.ai/specs/2026-08-07-projects-delivery-module.md`.

## Always

- Keep cross-module links as UUID fields only (`customerEntityId`, `dealId`, `projectManagerId`, `ownerEmployeeId`) — never ORM relations to `customers` / `staff`.
- Scope every query and command by `tenantId` / `organizationId`.
- Expose `updatedAt` on list/detail responses for optimistic locking.
- Use command pattern for create/update/delete (`commands/projects.ts`, `milestones.ts`, `risks.ts`).
- Compute milestone delay with `lib/milestoneDelay.ts` (do not invent alternate rules in UI).

## Ask First

- Ask before adding commercial settlement entities (contract/invoice) — that is M6 (`commercial`).
- Ask before applying `yarn db:migrate`.

## Never

- Never hard-delete projects/milestones/risks — soft-delete via `deletedAt`.
- Never fuzzy-match customer/deal by name for association.

## Validation Commands

```bash
yarn generate
yarn db:generate
yarn workspace @helios/core test -- milestoneDelay
yarn workspace @helios/core build
```

## Key paths

| Path | Role |
|------|------|
| `data/entities.ts` | Project, ProjectMilestone, ProjectRisk |
| `api/projects|milestones|risks/route.ts` | CRUD APIs |
| `backend/projects|milestones|risks/` | Admin UI |
| `lib/milestoneDelay.ts` | Delay rule |
