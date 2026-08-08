import type { ModuleInjectionTable } from '@helios/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'detail:projects.project:header': [
    {
      widgetId: 'commercial.injection.create-contract-from-project',
      priority: 80,
    },
  ],
  'detail:customers.company:header': [
    {
      widgetId: 'commercial.injection.create-contract-from-company',
      priority: 70,
    },
  ],
}

export default injectionTable
