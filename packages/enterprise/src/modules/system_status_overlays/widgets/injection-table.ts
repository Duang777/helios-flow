import type { ModuleInjectionTable } from '@helios/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'configs.system_status:details': [
    {
      widgetId: 'system_status_overlays.injection.enterprise-version',
      kind: 'stack',
      priority: 500,
    },
  ],
}

export default injectionTable
