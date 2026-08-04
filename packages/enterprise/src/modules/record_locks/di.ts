import { asFunction } from 'awilix'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { AppContainer } from '@helios/shared/lib/di/container'
import type { ModuleConfigService } from '@helios/core/modules/configs/lib/module-config-service'
import type { ActionLogService } from '@helios/core/modules/audit_logs/services/actionLogService'
import type { RbacService } from '@helios/core/modules/auth/services/rbacService'
import { createOptimisticLockGuardService } from '@helios/shared/lib/crud/optimistic-lock'
import { getAllOptimisticLockReaders } from '@helios/shared/lib/crud/optimistic-lock-store'
import { createCommandOptimisticLockGuardService } from '@helios/shared/lib/crud/optimistic-lock-command'
import { createRecordLockService } from './lib/recordLockService'
import type { RecordLockService } from './lib/recordLockService'
import { createRecordLockCrudMutationGuardService } from './lib/crudMutationGuardService'

export function register(container: AppContainer) {
  container.register({
    recordLockService: asFunction((
      em: EntityManager,
      moduleConfigService?: ModuleConfigService | null,
      actionLogService?: ActionLogService | null,
      rbacService?: RbacService | null,
    ) =>
      createRecordLockService({
        em,
        moduleConfigService: moduleConfigService ?? null,
        actionLogService: actionLogService ?? null,
        rbacService: rbacService ?? null,
      }),
    ).scoped(),
    // CRUD guard decorator: chains the OSS `updated_at` floor first (built here
    // because this DI key overrides the platform default), then adds the
    // record_locks enrichment. record_locks can only ADD a 409, never skip the
    // floor (S1/H2). Spec: .ai/specs/enterprise/2026-06-09-record-locks-unified-coverage.md (Phase 0)
    crudMutationGuardService: asFunction((
      recordLockService: RecordLockService,
      em: EntityManager,
    ) =>
      createRecordLockCrudMutationGuardService(
        recordLockService,
        createOptimisticLockGuardService({
          getEm: () => em,
          readers: getAllOptimisticLockReaders(),
        }),
      ),
    ).scoped(),
    // Command guard override: lock-backed `resolveExpected` derived from
    // authoritative server state (never requiring a client lock token, H2),
    // awaited by `enforceCommandOptimisticLockWithGuards`. The OSS floor still
    // runs first inside that runner.
    commandOptimisticLockGuardService: asFunction((recordLockService: RecordLockService) =>
      createCommandOptimisticLockGuardService({
        resolveExpected: ({ expectedFromHeader, resourceKind }) =>
          recordLockService.resolveExpectedVersion({ expectedFromHeader, resourceKind }),
      }),
    ).scoped(),
  })
}
