import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'dictionaries',
  title: 'Shared Dictionaries',
  version: '0.1.0',
  description: 'Organization-scoped dictionaries for reusable enumerations and appearance presets.',
  author: 'Helios Team',
  license: 'MIT',
}

export { features } from './acl'
