import type { ModuleSetupConfig } from '@helios/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['audit_logs.*'],
    employee: ['audit_logs.view_self', 'audit_logs.undo_self'],
  },
}

export default setup
