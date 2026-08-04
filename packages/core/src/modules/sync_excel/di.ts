import type { AppContainer } from '@helios/shared/lib/di/container'
import { registerDataSyncAdapter } from '../data_sync/lib/adapter-registry'
import { syncExcelCustomersAdapter } from './lib/adapters/customers'

export function register(_container: AppContainer) {
  registerDataSyncAdapter(syncExcelCustomersAdapter)
}

export default register
