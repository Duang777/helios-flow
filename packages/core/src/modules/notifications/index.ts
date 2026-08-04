import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'notifications',
  title: 'Notifications',
  version: '0.1.0',
  description: 'In-app notifications with module-extensible types and actions.',
  author: 'Helios Team',
  license: 'MIT',
}

export { features } from './acl'
