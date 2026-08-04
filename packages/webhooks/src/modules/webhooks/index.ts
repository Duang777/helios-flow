import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'webhooks',
  title: 'Webhooks',
  version: '0.1.0',
  description: 'Standard Webhooks compliant outbound webhook delivery for platform events.',
  author: 'Helios Team',
  license: 'MIT',
}

export { features } from './acl'
