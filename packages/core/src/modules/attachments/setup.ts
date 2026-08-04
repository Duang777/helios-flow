import type { ModuleSetupConfig } from '@helios/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['attachments.*', 'attachments.view', 'attachments.manage'],
    employee: ['attachments.view'],
  },
}

export default setup
