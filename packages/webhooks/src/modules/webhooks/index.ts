import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'webhooks',
  title: 'Webhooks',
  titleKey: 'webhooks.nav.title',
  version: '0.1.0',
  description: 'Standard Webhooks compliant outbound webhook delivery for platform events.',
  descriptionKey: 'webhooks.nav.description',
  author: 'Helios Team',
  license: 'MIT',
}

export { features } from './acl'
