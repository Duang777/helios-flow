import type { ModuleSetupConfig } from '@helios/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['messages.*'],
    admin: ['messages.*'],
    employee: ['messages.*'],
  },
}

export default setup
