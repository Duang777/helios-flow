import type { ModuleInfo } from '@helios/shared/modules/registry'
import './lib/providers'

export const metadata: ModuleInfo = {
  name: 'sales',
  title: 'Sales Management',
  version: '0.1.0',
  description:
    'Quoting, ordering, fulfillment, and billing capabilities built on modular pricing and tax pipelines.',
  author: 'Helios Team',
  license: 'MIT',
  requires: ['catalog', 'customers', 'dictionaries'],
  ejectable: true,
}

export { features } from './acl'
