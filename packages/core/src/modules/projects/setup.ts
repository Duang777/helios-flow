import type { ModuleSetupConfig } from '@helios/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['projects.*'],
    employee: ['projects.view'],
  },
}

export default setup
