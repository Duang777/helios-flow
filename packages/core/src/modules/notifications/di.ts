import type { AppContainer } from '@helios/shared/lib/di/container'
import { asFunction } from 'awilix'
import { createNotificationService } from './lib/notificationService'

export function register(container: AppContainer): void {
  container.register({
    notificationService: asFunction(({ em, eventBus, commandBus }) =>
      createNotificationService({ em, eventBus, commandBus })
    ).scoped().proxy(),
  })
}
