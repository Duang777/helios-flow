import type { ModuleSetupConfig } from '@helios/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['perspectives.use', 'perspectives.role_defaults'],
    employee: ['perspectives.use'],
  },
}

export default setup
