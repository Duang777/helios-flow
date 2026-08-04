import { asFunction } from 'awilix'
import type { AppContainer } from '@helios/shared/lib/di/container'
import { StorageDriverFactory } from './lib/drivers/driverFactory'

export function register(container: AppContainer) {
  container.register({
    storageDriverFactory: asFunction(({ em }: { em: ConstructorParameters<typeof StorageDriverFactory>[0] }) =>
      new StorageDriverFactory(em),
    )
      .singleton()
      .proxy(),
  })
}
