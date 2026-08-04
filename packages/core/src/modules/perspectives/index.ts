import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'perspectives',
  title: 'Table perspectives',
  version: '0.1.0',
  description: 'Shared persistence for DataTable perspectives (columns, filters, saved views).',
  author: 'Helios Team',
  license: 'MIT',
  ejectable: true,
}

export { features } from './acl'
