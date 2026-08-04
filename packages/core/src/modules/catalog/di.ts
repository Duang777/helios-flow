import { asFunction, asValue } from 'awilix'
import type { EventBus } from '@helios/events'
import type { AppContainer } from '@helios/shared/lib/di/container'
import { DefaultCatalogPricingService } from './services/catalogPricingService'
import { CatalogProduct, CatalogProductPrice } from './data/entities'

type AppCradle = AppContainer['cradle'] & {
  eventBus?: EventBus | null
}

export function register(container: AppContainer) {
  container.register({
    catalogPricingService: asFunction(({ eventBus }: AppCradle) => {
      return new DefaultCatalogPricingService(eventBus ?? null)
    })
      .singleton()
      .proxy(),
    CatalogProduct: asValue(CatalogProduct),
    CatalogProductPrice: asValue(CatalogProductPrice),
  })
}
