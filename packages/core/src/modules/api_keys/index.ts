import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'api_keys',
  title: 'API Keys',
  titleKey: 'api_keys.nav.apiKeys',
  version: '0.1.0',
  description: 'Manage access tokens for external API access.',
  descriptionKey: 'api_keys.nav.description',
  author: 'Helios Team',
  license: 'MIT',
  requires: ['auth'],
}

export { features } from './acl'
