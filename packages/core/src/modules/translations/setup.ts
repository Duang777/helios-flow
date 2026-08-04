import type { ModuleSetupConfig } from '@helios/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['translations.*'],
    employee: ['translations.view', 'translations.manage'],
  },
}

export default setup
