import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'messages',
  title: 'Messages',
  version: '0.1.0',
  description: 'Internal messaging system with attachments, actions, and email forwarding.',
  author: 'Helios Team',
  license: 'MIT',
}

export { features } from './acl'
