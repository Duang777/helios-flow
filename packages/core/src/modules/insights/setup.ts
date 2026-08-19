import type { ModuleSetupConfig } from '@helios/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['insights.*'],
    employee: ['insights.view'],
  },
}

export default setup
