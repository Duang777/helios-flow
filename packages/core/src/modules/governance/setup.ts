import type { ModuleSetupConfig } from '@helios/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['governance.*'],
    employee: ['governance.view'],
  },
}

export default setup
