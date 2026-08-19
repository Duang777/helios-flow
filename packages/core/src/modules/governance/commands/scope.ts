import type { FilterQuery } from '@mikro-orm/core'
import type { CommandRuntimeContext } from '@helios/shared/lib/commands'
import { buildScopedWhere } from '@helios/shared/lib/api/crud'
import {
  ensureOrganizationScope,
  ensureTenantScope,
} from '@helios/shared/lib/commands/scope'

type GovernanceCommandScopedRecord = {
  organizationId: string
  tenantId: string
}

export function buildGovernanceCommandWhere<T extends object>(
  ctx: CommandRuntimeContext,
  base: FilterQuery<T>,
): FilterQuery<T> {
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? undefined
  return buildScopedWhere(base as Record<string, unknown>, {
    organizationId,
    organizationIds: ctx.organizationIds ?? undefined,
    tenantId: ctx.auth?.tenantId ?? undefined,
  }) as FilterQuery<T>
}

export function ensureGovernanceCommandScope(
  ctx: CommandRuntimeContext,
  record: GovernanceCommandScopedRecord,
): void {
  ensureTenantScope(ctx, record.tenantId)
  ensureOrganizationScope(ctx, record.organizationId)
}
