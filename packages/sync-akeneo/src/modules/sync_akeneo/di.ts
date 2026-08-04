import { asValue } from 'awilix'
import type { AppContainer } from '@helios/shared/lib/di/container'
import { registerDataSyncAdapter } from '@helios/core/modules/data_sync/lib/adapter-registry'
import { akeneoHealthCheck } from './lib/health'
import { akeneoDataSyncAdapter } from './lib/adapter'

export function register(container: AppContainer) {
  registerDataSyncAdapter(akeneoDataSyncAdapter)

  container.register({
    akeneoHealthCheck: asValue(akeneoHealthCheck),
  })
}
