import type { ModuleInjectionTable } from '@helios/shared/modules/widgets/injection'

const operatingLoopTrigger = {
  widgetId: 'insights.injection.operating-loop-trigger',
  priority: 60,
}

export const injectionTable: ModuleInjectionTable = {
  'detail:projects.project:header': [operatingLoopTrigger],
  'detail:commercial.contract:header': [operatingLoopTrigger],
  'detail:commercial.invoice:header': [operatingLoopTrigger],
  'detail:insights.kpi_target:header': [operatingLoopTrigger],
  'detail:governance.finding:header': [operatingLoopTrigger],
}

export default injectionTable
