import type { ModuleSetupConfig } from '@helios/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['webhooks.*'],
    admin: ['webhooks.*'],
    employee: ['webhooks.view'],
  },
}

export default setup
