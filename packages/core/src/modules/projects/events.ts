import { createModuleEvents } from '@helios/shared/modules/events'

const events = [
  { id: 'projects.project.created', label: 'Project Created', entity: 'project', category: 'crud' },
  { id: 'projects.project.updated', label: 'Project Updated', entity: 'project', category: 'crud' },
  { id: 'projects.project.deleted', label: 'Project Deleted', entity: 'project', category: 'crud' },
  {
    id: 'projects.project_milestone.created',
    label: 'Project Milestone Created',
    entity: 'project_milestone',
    category: 'crud',
  },
  {
    id: 'projects.project_milestone.updated',
    label: 'Project Milestone Updated',
    entity: 'project_milestone',
    category: 'crud',
  },
  {
    id: 'projects.project_milestone.deleted',
    label: 'Project Milestone Deleted',
    entity: 'project_milestone',
    category: 'crud',
  },
  { id: 'projects.project_risk.created', label: 'Project Risk Created', entity: 'project_risk', category: 'crud' },
  { id: 'projects.project_risk.updated', label: 'Project Risk Updated', entity: 'project_risk', category: 'crud' },
  { id: 'projects.project_risk.deleted', label: 'Project Risk Deleted', entity: 'project_risk', category: 'crud' },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'projects',
  events,
})

export const emitProjectsEvent = eventsConfig.emit
export type ProjectsEventId = (typeof events)[number]['id']

export default eventsConfig
