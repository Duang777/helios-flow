export type OperatingLoopEntityType =
  | 'projects.project'
  | 'commercial.contract'
  | 'commercial.invoice'
  | 'commercial.payment'
  | 'commercial.payment_allocation'
  | 'insights.kpi_target'
  | 'governance.finding'
  | 'governance.identity_map'

export type OperatingLoopPageContext = {
  view: 'operating_loop.detail'
  entityType: OperatingLoopEntityType
  recordType: string
  recordId: string
  organizationId?: string
  extra: {
    projectId?: string
    contractId?: string
    invoiceId?: string
    paymentId?: string
    kpiTargetId?: string
    findingId?: string
    customerEntityId?: string
  }
}

type HostRecord = {
  id?: unknown
  organizationId?: unknown
  projectId?: unknown
  contractId?: unknown
  invoiceId?: unknown
  paymentId?: unknown
  customerEntityId?: unknown
}

export type OperatingLoopHostContext = {
  entityType?: unknown
  recordId?: unknown
  organizationId?: unknown
  projectId?: unknown
  contractId?: unknown
  invoiceId?: unknown
  paymentId?: unknown
  kpiTargetId?: unknown
  findingId?: unknown
  customerEntityId?: unknown
  data?: Record<string, HostRecord | undefined>
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function isOperatingLoopEntityType(value: unknown): value is OperatingLoopEntityType {
  return (
    value === 'projects.project' ||
    value === 'commercial.contract' ||
    value === 'commercial.invoice' ||
    value === 'commercial.payment' ||
    value === 'commercial.payment_allocation' ||
    value === 'insights.kpi_target' ||
    value === 'governance.finding' ||
    value === 'governance.identity_map'
  )
}

function firstRecord(data: OperatingLoopHostContext['data'] | undefined): HostRecord | undefined {
  if (!data) return undefined
  return Object.values(data).find((record): record is HostRecord => Boolean(record))
}

function recordTypeFromEntityType(entityType: OperatingLoopEntityType): string {
  const parts = entityType.split('.')
  return parts[parts.length - 1] ?? entityType
}

export function buildOperatingLoopPageContext(
  context?: OperatingLoopHostContext,
  data?: OperatingLoopHostContext['data'],
): OperatingLoopPageContext | null {
  const record = firstRecord(data) ?? firstRecord(context?.data)
  const entityType = isOperatingLoopEntityType(context?.entityType) ? context.entityType : null
  const recordId = readString(context?.recordId) ?? readString(record?.id)
  if (!entityType || !recordId) return null

  const extra = {
    projectId: readString(context?.projectId) ?? readString(record?.projectId),
    contractId: readString(context?.contractId) ?? readString(record?.contractId),
    invoiceId: readString(context?.invoiceId) ?? readString(record?.invoiceId),
    paymentId: readString(context?.paymentId) ?? readString(record?.paymentId),
    kpiTargetId: readString(context?.kpiTargetId),
    findingId: readString(context?.findingId),
    customerEntityId: readString(context?.customerEntityId) ?? readString(record?.customerEntityId),
  }

  return {
    view: 'operating_loop.detail',
    entityType,
    recordType: recordTypeFromEntityType(entityType),
    recordId,
    organizationId: readString(context?.organizationId) ?? readString(record?.organizationId),
    extra,
  }
}
