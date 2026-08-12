import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'feature_toggles',
  title: 'Feature Toggles',
  titleKey: 'feature_toggles.nav.group',
  version: '0.1.0',
  description: 'Global feature flags with tenant-level overrides.',
  descriptionKey: 'feature_toggles.nav.description',
  author: 'Helios Team',
  license: 'MIT',
}

export { features } from './acl'
