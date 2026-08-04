import { asClass } from 'awilix'
import type { AppContainer } from '@helios/shared/lib/di/container'
import { ActionLogService } from '@helios/core/modules/audit_logs/services/actionLogService'
import { AccessLogService } from '@helios/core/modules/audit_logs/services/accessLogService'

export function register(container: AppContainer) {
  container.register({
    actionLogService: asClass(ActionLogService).scoped(),
  })

  container.register({
    accessLogService: asClass(AccessLogService).scoped(),
  })
}
