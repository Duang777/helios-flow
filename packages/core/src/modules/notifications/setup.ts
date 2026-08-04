import type { ModuleSetupConfig } from '@helios/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['notifications.*'],
    admin: ['notifications.*'],
    employee: ['notifications.view'],
  },
}

export default setup
