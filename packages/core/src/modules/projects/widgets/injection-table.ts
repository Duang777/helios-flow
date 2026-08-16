import type { ModuleInjectionTable } from '@helios/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'detail:customers.deal:header': [
    {
      widgetId: 'projects.injection.create-project-from-deal',
      priority: 80,
    },
  ],
  'detail:customers.company:header': [
    {
      widgetId: 'projects.injection.create-project-from-company',
      priority: 80,
    },
  ],
}

export default injectionTable
