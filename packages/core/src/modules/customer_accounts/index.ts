import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'customer_accounts',
  title: 'Customer Identity & Portal Authentication',
  version: '0.1.0',
  description: 'Customer-facing authentication with two-tier identity model and full RBAC.',
  author: 'Helios Team',
  license: 'MIT',
  ejectable: true,
}

export { features } from './acl'
