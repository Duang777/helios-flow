import { createModuleEvents } from '@helios/shared/modules/events'

const events = [
  { id: 'insights.kpi_target.created', label: 'KPI Target Created', entity: 'kpi_target', category: 'crud' },
  { id: 'insights.kpi_target.updated', label: 'KPI Target Updated', entity: 'kpi_target', category: 'crud' },
  { id: 'insights.kpi_target.deleted', label: 'KPI Target Deleted', entity: 'kpi_target', category: 'crud' },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'insights',
  events,
})

export const emitInsightsEvent = eventsConfig.emit
export type InsightsEventId = (typeof events)[number]['id']

export default eventsConfig
