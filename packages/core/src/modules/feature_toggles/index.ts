import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'feature_toggles',
  title: 'Feature Toggles',
  version: '0.1.0',
  description: 'Global feature flags with tenant-level overrides.',
  author: 'Helios Team',
  license: 'MIT',
}

export { features } from './acl'
