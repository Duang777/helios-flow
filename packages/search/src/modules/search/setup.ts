import type { ModuleSetupConfig } from '@helios/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['search.*', 'vector.*'],
    employee: ['vector.*'],
  },
}

export default setup
