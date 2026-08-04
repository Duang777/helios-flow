import { asFunction } from 'awilix'
import type { AppContainer } from '@helios/shared/lib/di/container'
import { DefaultPlannerAvailabilityService } from './services/plannerAvailabilityService'

export function register(container: AppContainer) {
  container.register({
    plannerAvailabilityService: asFunction(() => {
      return new DefaultPlannerAvailabilityService()
    }).singleton(),
  })
}
