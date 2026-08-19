import { createModuleEvents } from '@helios/shared/modules/events'

const events = [
  { id: 'commercial.contract.created', label: 'Contract Created', entity: 'contract', category: 'crud' },
  { id: 'commercial.contract.updated', label: 'Contract Updated', entity: 'contract', category: 'crud' },
  { id: 'commercial.contract.deleted', label: 'Contract Deleted', entity: 'contract', category: 'crud' },
  {
    id: 'commercial.project_revenue.created',
    label: 'Project Revenue Created',
    entity: 'project_revenue',
    category: 'crud',
  },
  {
    id: 'commercial.project_revenue.updated',
    label: 'Project Revenue Updated',
    entity: 'project_revenue',
    category: 'crud',
  },
  {
    id: 'commercial.project_revenue.deleted',
    label: 'Project Revenue Deleted',
    entity: 'project_revenue',
    category: 'crud',
  },
  {
    id: 'commercial.project_cost.created',
    label: 'Project Cost Created',
    entity: 'project_cost',
    category: 'crud',
  },
  {
    id: 'commercial.project_cost.updated',
    label: 'Project Cost Updated',
    entity: 'project_cost',
    category: 'crud',
  },
  {
    id: 'commercial.project_cost.deleted',
    label: 'Project Cost Deleted',
    entity: 'project_cost',
    category: 'crud',
  },
  { id: 'commercial.invoice.created', label: 'Invoice Created', entity: 'invoice', category: 'crud' },
  { id: 'commercial.invoice.updated', label: 'Invoice Updated', entity: 'invoice', category: 'crud' },
  { id: 'commercial.invoice.deleted', label: 'Invoice Deleted', entity: 'invoice', category: 'crud' },
  { id: 'commercial.payment.created', label: 'Payment Created', entity: 'payment', category: 'crud' },
  { id: 'commercial.payment.updated', label: 'Payment Updated', entity: 'payment', category: 'crud' },
  { id: 'commercial.payment.deleted', label: 'Payment Deleted', entity: 'payment', category: 'crud' },
  {
    id: 'commercial.payment_allocation.created',
    label: 'Payment Allocation Created',
    entity: 'payment_allocation',
    category: 'crud',
  },
  {
    id: 'commercial.payment_allocation.updated',
    label: 'Payment Allocation Updated',
    entity: 'payment_allocation',
    category: 'crud',
  },
  {
    id: 'commercial.payment_allocation.deleted',
    label: 'Payment Allocation Deleted',
    entity: 'payment_allocation',
    category: 'crud',
  },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'commercial',
  events,
})

export const emitCommercialEvent = eventsConfig.emit
export type CommercialEventId = (typeof events)[number]['id']

export default eventsConfig
