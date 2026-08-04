import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'catalog',
  title: 'Product Catalog',
  version: '0.1.0',
  description: 'Configurable catalog for products, variants, and pricing used by the sales module.',
  author: 'Helios Team',
  license: 'MIT',
  ejectable: true,
}

export { features } from './acl'
