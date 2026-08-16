import { createModuleEvents } from '@helios/shared/modules/events'

const events = [
  {
    id: 'governance.identity_map.created',
    label: 'Identity Map Created',
    entity: 'identity_map',
    category: 'crud',
  },
  {
    id: 'governance.identity_map.updated',
    label: 'Identity Map Updated',
    entity: 'identity_map',
    category: 'crud',
  },
  {
    id: 'governance.identity_map.deleted',
    label: 'Identity Map Deleted',
    entity: 'identity_map',
    category: 'crud',
  },
  {
    id: 'governance.finding.created',
    label: 'Finding Created',
    entity: 'finding',
    category: 'crud',
  },
  {
    id: 'governance.finding.updated',
    label: 'Finding Updated',
    entity: 'finding',
    category: 'crud',
  },
  {
    id: 'governance.finding.deleted',
    label: 'Finding Deleted',
    entity: 'finding',
    category: 'crud',
  },
  {
    id: 'governance.rules.run',
    label: 'Governance Rules Run',
    entity: 'finding',
    category: 'system',
    excludeFromTriggers: true,
  },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'governance',
  events,
})

export const emitGovernanceEvent = eventsConfig.emit
export type GovernanceEventId = (typeof events)[number]['id']

export default eventsConfig
