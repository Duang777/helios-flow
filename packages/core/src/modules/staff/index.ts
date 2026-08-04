import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'staff',
  title: 'Employees',
  version: '0.1.0',
  description: 'Teams, roles, and employee rosters.',
  author: 'Helios Team',
  license: 'MIT',
  requires: ['planner', 'resources'],
  ejectable: true,
}

export { features } from './acl'
