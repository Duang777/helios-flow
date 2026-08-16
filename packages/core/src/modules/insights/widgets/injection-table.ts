import type { ModuleInjectionTable } from '@helios/shared/modules/widgets/injection'

const operatingLoopTrigger = {
  widgetId: 'insights.injection.operating-loop-trigger',
  priority: 60,
}

export const injectionTable: ModuleInjectionTable = {
  'data-table:projects.list:search-trailing': [operatingLoopTrigger],
  'data-table:projects.milestones.list:search-trailing': [operatingLoopTrigger],
  'data-table:projects.risks.list:search-trailing': [operatingLoopTrigger],
  'data-table:commercial.contracts.list:search-trailing': [operatingLoopTrigger],
  'data-table:commercial.invoices.list:search-trailing': [operatingLoopTrigger],
  'data-table:commercial.payments.list:search-trailing': [operatingLoopTrigger],
  'data-table:commercial.allocations.list:search-trailing': [operatingLoopTrigger],
  'data-table:insights.kpi_targets.list:search-trailing': [operatingLoopTrigger],
  'data-table:insights.kpi.completion:search-trailing': [operatingLoopTrigger],
  'data-table:governance.findings.list:search-trailing': [operatingLoopTrigger],
  'data-table:governance.identity_maps.list:search-trailing': [operatingLoopTrigger],
  'detail:projects.project:header': [operatingLoopTrigger],
  'crud-form:projects.milestone:header': [operatingLoopTrigger],
  'crud-form:projects.risk:header': [operatingLoopTrigger],
  'detail:commercial.contract:header': [operatingLoopTrigger],
  'detail:commercial.invoice:header': [operatingLoopTrigger],
  'crud-form:commercial.payment:header': [operatingLoopTrigger],
  'crud-form:commercial.payment_allocation:header': [operatingLoopTrigger],
  'detail:insights.kpi_target:header': [operatingLoopTrigger],
  'detail:governance.finding:header': [operatingLoopTrigger],
  'crud-form:governance.identity_map:header': [operatingLoopTrigger],
}

export default injectionTable
