export type OperatingLoopEntityType =
  | 'customers.person'
  | 'customers.company'
  | 'customers.customer_entity'
  | 'customers.deal'
  | 'sales.order'
  | 'sales.quote'
  | 'inbox_ops.proposal'
  | 'catalog.product'
  | 'wms.warehouse'
  | 'wms.inventory_balance'
  | 'wms.inventory_reservation'
  | 'workflows.instance'
  | 'workflows.task'
  | 'integrations.integration'
  | 'projects.project'
  | 'projects.milestone'
  | 'projects.risk'
  | 'commercial.contract'
  | 'commercial.invoice'
  | 'commercial.payment'
  | 'commercial.payment_allocation'
  | 'insights.kpi_target'
  | 'insights.kpi_completion'
  | 'insights.operating_loop_digest'
  | 'governance.finding'
  | 'governance.identity_map'
  | 'messages.message'
  | 'staff.team_member'
  | 'staff.leave_request'

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
    personId?: string
    dealId?: string
    orderId?: string
    quoteId?: string
    productId?: string
    warehouseId?: string
    instanceId?: string
    taskId?: string
    integrationId?: string
    proposalId?: string
    messageId?: string
    teamMemberId?: string
    leaveRequestId?: string
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
  personId?: unknown
  dealId?: unknown
  orderId?: unknown
  quoteId?: unknown
  productId?: unknown
  warehouseId?: unknown
  instanceId?: unknown
  taskId?: unknown
  integrationId?: unknown
  proposalId?: unknown
  messageId?: unknown
  teamMemberId?: unknown
  leaveRequestId?: unknown
  resourceKind?: unknown
  resourceId?: unknown
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

const OPERATING_LOOP_ENTITY_TYPES = new Set<OperatingLoopEntityType>([
  'customers.person',
  'customers.company',
  'customers.customer_entity',
  'customers.deal',
  'sales.order',
  'sales.quote',
  'inbox_ops.proposal',
  'catalog.product',
  'wms.warehouse',
  'wms.inventory_balance',
  'wms.inventory_reservation',
  'workflows.instance',
  'workflows.task',
  'integrations.integration',
  'projects.project',
  'projects.milestone',
  'projects.risk',
  'commercial.contract',
  'commercial.invoice',
  'commercial.payment',
  'commercial.payment_allocation',
  'insights.kpi_target',
  'insights.kpi_completion',
  'insights.operating_loop_digest',
  'governance.finding',
  'governance.identity_map',
  'messages.message',
  'staff.team_member',
  'staff.leave_request',
])

function isOperatingLoopEntityType(value: unknown): value is OperatingLoopEntityType {
  return typeof value === 'string' && OPERATING_LOOP_ENTITY_TYPES.has(value as OperatingLoopEntityType)
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
  'customers.people.list': 'customers.person',
  'customers.companies.list': 'customers.company',
  'customers.deals.list': 'customers.deal',
  'sales.orders': 'sales.order',
  'sales.quotes': 'sales.quote',
  'inbox_ops.proposals.list': 'inbox_ops.proposal',
  'catalog.products': 'catalog.product',
  'catalog.products.list': 'catalog.product',
  'wms.inventory.balances': 'wms.inventory_balance',
  'wms.inventory.reservations': 'wms.inventory_reservation',
  'workflows.instances.list': 'workflows.instance',
  'workflows.tasks.list': 'workflows.task',
  'projects.list': 'projects.project',
  'projects.milestones.list': 'projects.milestone',
  'projects.risks.list': 'projects.risk',
  'commercial.contracts.list': 'commercial.contract',
  'commercial.invoices.list': 'commercial.invoice',
  'commercial.payments.list': 'commercial.payment',
  'commercial.allocations.list': 'commercial.payment_allocation',
  'insights.kpi_targets.list': 'insights.kpi_target',
  'insights.kpi.completion': 'insights.kpi_completion',
  'insights.operating_loop.today': 'insights.operating_loop_digest',
  'governance.findings.list': 'governance.finding',
  'governance.identity_maps.list': 'governance.identity_map',
  'integrations.marketplace': 'integrations.integration',
  'messages': 'messages.message',
  'staff.team_members': 'staff.team_member',
  'staff.leave_requests': 'staff.leave_request',
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
    customerEntityId:
      readString(context?.customerEntityId) ??
      readString(record?.customerEntityId) ??
      (entityType === 'customers.company' || entityType === 'customers.customer_entity'
        ? (recordId ?? undefined)
        : undefined),
    personId:
      readString(context?.personId) ??
      (entityType === 'customers.person' && recordId ? recordId : undefined),
    dealId:
      readString(context?.dealId) ??
      (entityType === 'customers.deal' && recordId ? recordId : undefined),
    orderId:
      readString(context?.orderId) ??
      (entityType === 'sales.order' && recordId ? recordId : undefined),
    quoteId:
      readString(context?.quoteId) ??
      (entityType === 'sales.quote' && recordId ? recordId : undefined),
    productId:
      readString(context?.productId) ??
      (entityType === 'catalog.product' && recordId ? recordId : undefined),
    warehouseId:
      readString(context?.warehouseId) ??
      (entityType === 'wms.warehouse' && recordId ? recordId : undefined),
    instanceId:
      readString(context?.instanceId) ??
      (entityType === 'workflows.instance' && recordId ? recordId : undefined),
    taskId:
      readString(context?.taskId) ??
      (entityType === 'workflows.task' && recordId ? recordId : undefined),
    integrationId:
      readString(context?.integrationId) ??
      (entityType === 'integrations.integration' && recordId ? recordId : undefined),
    proposalId:
      readString(context?.proposalId) ??
      (entityType === 'inbox_ops.proposal' && recordId ? recordId : undefined),
    messageId:
      readString(context?.messageId) ??
      (entityType === 'messages.message' && recordId ? recordId : undefined),
    teamMemberId:
      readString(context?.teamMemberId) ??
      (entityType === 'staff.team_member' && recordId ? recordId : undefined),
    leaveRequestId:
      readString(context?.leaveRequestId) ??
      (entityType === 'staff.leave_request' && recordId ? recordId : undefined),
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
    : isOperatingLoopEntityType(context?.resourceKind)
      ? context.resourceKind
      : isOperatingLoopEntityType(context?.entityId)
        ? context.entityId
        : null
  const entityType = rawEntityType
  const recordId =
    readString(context?.recordId) ??
    readString(context?.resourceId) ??
    readString(record?.id)
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
