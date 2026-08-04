import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'record_locks',
  title: 'Record Locking',
  version: '0.1.0',
  description: 'Optimistic and pessimistic record locking with conflict resolution.',
  author: 'Helios Team',
  license: 'Proprietary',
}

export { features } from './acl'
