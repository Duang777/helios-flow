import type { FilterQuery } from '@mikro-orm/core'
import type { CommandRuntimeContext } from '@helios/shared/lib/commands'
import { buildScopedWhere } from '@helios/shared/lib/api/crud'
import {
  ensureOrganizationScope,
  ensureTenantScope,
} from '@helios/shared/lib/commands/scope'

type CommercialCommandScopedRecord = {
  organizationId: string
  tenantId: string
}

export function buildCommercialCommandWhere<T extends object>(
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

export function ensureCommercialCommandScope(
  ctx: CommandRuntimeContext,
  record: CommercialCommandScopedRecord,
): void {
  ensureTenantScope(ctx, record.tenantId)
  ensureOrganizationScope(ctx, record.organizationId)
}
