export type OperatingLoopEntityType =
  | 'projects.project'
  | 'projects.milestone'
  | 'projects.risk'
  | 'commercial.contract'
  | 'commercial.invoice'
  | 'commercial.payment'
  | 'commercial.payment_allocation'
  | 'insights.kpi_target'
  | 'insights.kpi_completion'
  | 'governance.finding'
  | 'governance.identity_map'

export type OperatingLoopPageContext = {
  view: 'operating_loop.detail' | 'operating_loop.list'
  entityType: OperatingLoopEntityType
  recordType: string
  recordId: string | null
  organizationId?: string
  tableId?: string
  searchValue?: string
  visibleFilters?: Record<string, unknown>
  page?: number
  pageSize?: number
  totalMatching?: number
  selectedRecordIds?: string[]
  extra: {
    projectId?: string
    milestoneId?: string
    riskId?: string
    contractId?: string
    invoiceId?: string
    paymentId?: string
    allocationId?: string
    kpiTargetId?: string
    findingId?: string
    identityMapId?: string
    customerEntityId?: string
  }
}

type HostRecord = {
  id?: unknown
  organizationId?: unknown
  projectId?: unknown
  milestoneId?: unknown
  riskId?: unknown
  contractId?: unknown
  invoiceId?: unknown
  paymentId?: unknown
  allocationId?: unknown
  customerEntityId?: unknown
}

export type OperatingLoopHostContext = {
  tableId?: unknown
  entityId?: unknown
  entityType?: unknown
  recordId?: unknown
  organizationId?: unknown
  projectId?: unknown
  milestoneId?: unknown
  riskId?: unknown
  contractId?: unknown
  invoiceId?: unknown
  paymentId?: unknown
  allocationId?: unknown
  kpiTargetId?: unknown
  findingId?: unknown
  identityMapId?: unknown
  customerEntityId?: unknown
  searchValue?: unknown
  visibleFilters?: unknown
  page?: unknown
  pageSize?: unknown
  totalMatching?: unknown
  selectedRowIds?: unknown
  data?: Record<string, unknown>
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function isOperatingLoopEntityType(value: unknown): value is OperatingLoopEntityType {
  return (
    value === 'projects.project' ||
    value === 'projects.milestone' ||
    value === 'projects.risk' ||
    value === 'commercial.contract' ||
    value === 'commercial.invoice' ||
    value === 'commercial.payment' ||
    value === 'commercial.payment_allocation' ||
    value === 'insights.kpi_target' ||
    value === 'insights.kpi_completion' ||
    value === 'governance.finding' ||
    value === 'governance.identity_map'
  )
}

function isHostRecord(value: unknown): value is HostRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function firstRecord(data: Record<string, unknown> | undefined): HostRecord | undefined {
  if (!data) return undefined
  return Object.values(data).find(isHostRecord)
}

function recordTypeFromEntityType(entityType: OperatingLoopEntityType): string {
  const parts = entityType.split('.')
  return parts[parts.length - 1] ?? entityType
}

const LIST_TABLE_ENTITY_TYPES: Record<string, OperatingLoopEntityType> = {
  'projects.list': 'projects.project',
  'projects.milestones.list': 'projects.milestone',
  'projects.risks.list': 'projects.risk',
  'commercial.contracts.list': 'commercial.contract',
  'commercial.invoices.list': 'commercial.invoice',
  'commercial.payments.list': 'commercial.payment',
  'commercial.allocations.list': 'commercial.payment_allocation',
  'insights.kpi_targets.list': 'insights.kpi_target',
  'insights.kpi.completion': 'insights.kpi_completion',
  'governance.findings.list': 'governance.finding',
  'governance.identity_maps.list': 'governance.identity_map',
}

function readPositiveInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return undefined
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const values = value
    .map((item) => readString(item))
    .filter((item): item is string => typeof item === 'string')
  return values.length > 0 ? values : undefined
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function buildExtra(
  context: OperatingLoopHostContext | undefined,
  record: HostRecord | undefined,
  entityType?: OperatingLoopEntityType,
  recordId?: string | null,
): OperatingLoopPageContext['extra'] {
  return {
    projectId: readString(context?.projectId) ?? readString(record?.projectId),
    milestoneId:
      readString(context?.milestoneId) ??
      (entityType === 'projects.milestone' && recordId ? recordId : undefined),
    riskId:
      readString(context?.riskId) ??
      (entityType === 'projects.risk' && recordId ? recordId : undefined),
    contractId: readString(context?.contractId) ?? readString(record?.contractId),
    invoiceId: readString(context?.invoiceId) ?? readString(record?.invoiceId),
    paymentId: readString(context?.paymentId) ?? readString(record?.paymentId),
    allocationId:
      readString(context?.allocationId) ??
      (entityType === 'commercial.payment_allocation' && recordId ? recordId : undefined),
    kpiTargetId:
      readString(context?.kpiTargetId) ??
      (entityType === 'insights.kpi_target' && recordId ? recordId : undefined),
    findingId:
      readString(context?.findingId) ??
      (entityType === 'governance.finding' && recordId ? recordId : undefined),
    identityMapId:
      readString(context?.identityMapId) ??
      (entityType === 'governance.identity_map' && recordId ? recordId : undefined),
    customerEntityId: readString(context?.customerEntityId) ?? readString(record?.customerEntityId),
  }
}

function buildListContext(context: OperatingLoopHostContext): OperatingLoopPageContext | null {
  const tableId = readString(context.tableId)
  const entityType = tableId ? LIST_TABLE_ENTITY_TYPES[tableId] : undefined
  if (!tableId || !entityType) return null

  return {
    view: 'operating_loop.list',
    entityType,
    recordType: recordTypeFromEntityType(entityType),
    recordId: null,
    organizationId: readString(context.organizationId),
    tableId,
    searchValue: readString(context.searchValue),
    visibleFilters: readRecord(context.visibleFilters),
    page: readPositiveInteger(context.page),
    pageSize: readPositiveInteger(context.pageSize),
    totalMatching: readPositiveInteger(context.totalMatching),
    selectedRecordIds: readStringArray(context.selectedRowIds),
    extra: buildExtra(context, undefined, entityType, null),
  }
}

export function buildOperatingLoopPageContext(
  context?: OperatingLoopHostContext,
  data?: Record<string, unknown>,
): OperatingLoopPageContext | null {
  const listContext = context ? buildListContext(context) : null
  if (listContext) return listContext

  const record = firstRecord(data) ?? firstRecord(context?.data)
  const rawEntityType = isOperatingLoopEntityType(context?.entityType)
    ? context.entityType
    : isOperatingLoopEntityType(context?.entityId)
      ? context.entityId
      : null
  const entityType = rawEntityType
  const recordId = readString(context?.recordId) ?? readString(record?.id)
  if (!entityType || !recordId) return null

  const extra = buildExtra(context, record, entityType, recordId)

  return {
    view: 'operating_loop.detail',
    entityType,
    recordType: recordTypeFromEntityType(entityType),
    recordId,
    organizationId: readString(context?.organizationId) ?? readString(record?.organizationId),
    extra,
  }
}
