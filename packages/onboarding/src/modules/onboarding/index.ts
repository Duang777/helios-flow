import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'onboarding',
  title: 'Onboarding',
  version: '0.1.0',
  description: 'Self-service tenant and organization onboarding flow.',
  author: 'Helios Team',
  license: 'MIT',
}

export { features } from './acl'
