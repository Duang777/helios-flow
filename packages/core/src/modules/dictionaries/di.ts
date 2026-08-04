import { asValue } from 'awilix'
import type { AppContainer } from '@helios/shared/lib/di/container'
import { Dictionary, DictionaryEntry } from './data/entities'

export function register(container: AppContainer) {
  container.register({
    Dictionary: asValue(Dictionary),
    DictionaryEntry: asValue(DictionaryEntry),
  })
}
