import type { ModuleSetupConfig } from '@helios/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['progress.*'],
    employee: ['progress.view'],
  },
}

export default setup
