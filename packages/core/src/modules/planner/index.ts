import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'planner',
  title: 'Worktime / Availabilities',
  version: '0.1.0',
  description: 'Availability schedules, rulesets, and shared planning rules.',
  author: 'Helios Team',
  license: 'MIT',
  ejectable: true,
}

export { features } from './acl'
