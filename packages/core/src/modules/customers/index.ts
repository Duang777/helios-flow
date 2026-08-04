import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'customers',
  title: 'Customer Relationship Management',
  version: '0.1.0',
  description: 'Core CRM capabilities for people, companies, deals, and activities.',
  author: 'Helios Team',
  license: 'MIT',
  ejectable: true,
}

export { features } from './acl'
