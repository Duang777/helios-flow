import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'dashboards',
  title: 'Admin Dashboards',
  version: '0.1.0',
  description: 'Configurable admin dashboard with module-provided widgets.',
  author: 'Helios Team',
  license: 'MIT',
}

export { features } from './acl'
