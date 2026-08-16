import type { ModuleSetupConfig } from '@helios/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['commercial.*'],
    employee: ['commercial.view'],
  },
}

export default setup
