import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'auth',
  title: 'Authentication & Accounts',
  version: '0.1.0',
  description: 'User accounts, sessions, roles and password resets.',
  author: 'Helios Team',
  license: 'MIT',
}

// Re-export features from module root acl.ts so generator can pick them up regardless of consumer imports
export { features } from './acl'
