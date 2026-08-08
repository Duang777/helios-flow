import { upsertGovernanceFinding } from '../rules/upsert'
import { RULE_PROJECT_MILESTONE_DELAYED } from '../rules/project_milestone_delayed'

describe('governance rules upsert', () => {
  it('creates then updates by natural key', async () => {
    const store: Array<Record<string, unknown>> = []
    const em = {
      findOne: jest.fn(async (_entity, where: Record<string, unknown>) =>
        store.find(
          (row) =>
            row.tenantId === where.tenantId &&
            row.organizationId === where.organizationId &&
            row.ruleId === where.ruleId &&
            row.subjectType === where.subjectType &&
            row.subjectId === where.subjectId &&
            row.asOf === where.asOf &&
            row.deletedAt == null,
        ) ?? null,
      ),
      create: jest.fn((_entity, data: Record<string, unknown>) => {
        const row = { ...data, id: 'finding-1' }
        store.push(row)
        return row
      }),
    }

    const scope = {
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      asOf: '2026-08-08',
    }
    const candidate = {
      ruleId: RULE_PROJECT_MILESTONE_DELAYED,
      severity: 'warning' as const,
      title: 'Delayed milestone',
      reason: 'Planned date passed',
      evidenceIds: [{ type: 'milestone', id: 'ms-1', module: 'projects' }],
      subjectType: 'milestone',
      subjectId: 'ms-1',
    }

    const created = await upsertGovernanceFinding(em as never, scope, candidate)
    expect(created).toBe('created')
    expect(em.create).toHaveBeenCalledTimes(1)

    const updated = await upsertGovernanceFinding(em as never, scope, {
      ...candidate,
      title: 'Delayed milestone (updated)',
    })
    expect(updated).toBe('updated')
    expect(store[0].title).toBe('Delayed milestone (updated)')
  })
})
