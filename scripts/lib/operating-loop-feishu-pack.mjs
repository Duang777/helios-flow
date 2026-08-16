const SHEET_HEADERS = {
  organization: ['org_id', 'org_name', 'parent_org_id', 'org_type'],
  employee: ['employee_id', 'employee_name', 'org_id', 'role', 'status'],
  customer: [
    'customer_id',
    'customer_name',
    'customer_short_name',
    'industry',
    'customer_level',
    'org_id',
    'owner_employee_id',
    'customer_status',
    'source_record_id',
  ],
  opportunity: [
    'opportunity_id',
    'opportunity_name',
    'customer_id',
    'org_id',
    'owner_employee_id',
    'biz_category',
    'product_line_code',
    'opportunity_stage',
    'estimated_amount',
    'win_probability',
    'estimated_win_date',
    'last_followup_date',
    'opportunity_status',
    'loss_reason',
  ],
  opportunity_followup: [
    'followup_id',
    'opportunity_id',
    'employee_id',
    'followup_date',
    'followup_content',
    'next_plan',
  ],
  project: [
    'project_id',
    'project_name',
    'customer_id',
    'opportunity_id',
    'org_id',
    'project_manager_id',
    'product_line_code',
    'project_stage',
    'project_status',
    'planned_start_date',
    'planned_end_date',
    'actual_start_date',
    'actual_end_date',
    'budget_revenue',
    'budget_cost',
    'forecast_revenue',
    'forecast_cost',
  ],
  project_milestone: [
    'milestone_id',
    'project_id',
    'milestone_name',
    'planned_date',
    'actual_date',
    'status',
  ],
  project_risk: [
    'risk_id',
    'project_id',
    'risk_type',
    'risk_level',
    'risk_description',
    'owner_employee_id',
    'risk_status',
  ],
  contract: [
    'contract_id',
    'contract_name',
    'customer_id',
    'project_id',
    'opportunity_id',
    'org_id',
    'contract_type',
    'contract_amount',
    'currency',
    'tax_basis',
    'sign_date',
    'effective_date',
    'expiry_date',
    'payment_terms',
    'contract_status',
  ],
  project_revenue: [
    'revenue_id',
    'project_id',
    'contract_id',
    'customer_id',
    'org_id',
    'period_code',
    'revenue_type',
    'recognized_revenue',
    'currency',
    'tax_basis',
    'recognition_date',
    'data_version',
  ],
  project_cost: [
    'cost_id',
    'project_id',
    'contract_id',
    'customer_id',
    'org_id',
    'period_code',
    'cost_type',
    'cost_amount',
    'cost_direct_type',
    'allocation_rule',
    'currency',
    'tax_basis',
    'cost_date',
    'data_version',
  ],
  invoice: [
    'invoice_id',
    'contract_id',
    'project_id',
    'customer_id',
    'invoice_date',
    'invoice_amount',
    'currency',
    'invoice_status',
    'due_date',
  ],
  payment: [
    'payment_id',
    'customer_id',
    'payment_date',
    'payment_amount',
    'currency',
    'payment_method',
  ],
  invoice_payment_relation: [
    'relation_id',
    'invoice_id',
    'payment_id',
    'allocated_amount',
    'allocation_date',
  ],
  kpi_target: [
    'target_id',
    'kpi_type',
    'org_object_type',
    'org_object_code',
    'org_object_name',
    'biz_category',
    'period_type',
    'period_code',
    'target_value',
    'unit',
  ],
}

export const EXPECTED_FEISHU_SHEETS = Object.keys(SHEET_HEADERS)

function text(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function trimTrailingEmptyCells(values) {
  const next = [...values]
  while (next.length > 0 && text(next[next.length - 1]).length === 0) {
    next.pop()
  }
  return next
}

function optionalText(value) {
  const result = text(value)
  return result.length > 0 ? result : null
}

function decimalString(value) {
  const raw = text(value)
  if (!raw) return null
  const number = Number(raw.replaceAll(',', ''))
  if (!Number.isFinite(number)) return null
  return number.toFixed(2)
}

function decimalNumber(value) {
  const normalized = decimalString(value)
  if (!normalized) return null
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function integerNumber(value) {
  const number = Number(text(value).replaceAll(',', ''))
  return Number.isFinite(number) ? Math.round(number) : null
}

function sourceTag(entity, sourceId) {
  return `feishu:${entity}_id=${sourceId}`
}

function sourceReference(entity, sourceId, extra = null) {
  const parts = [sourceTag(entity, sourceId)]
  if (extra) parts.push(extra)
  return parts.join(';')
}

function normalizeStatus(value, mappings, fallback, mappingWarnings, field) {
  const original = text(value)
  const normalized = mappings[original] ?? fallback
  if (original && !mappings[original]) {
    mappingWarnings.push({
      code: 'unknown_source_value',
      field,
      value: original,
      mappedValue: normalized,
    })
  }
  return normalized
}

function normalizeDate(value) {
  return optionalText(value)
}

export function rowsToFeishuRecords(sheetName, rows) {
  const expected = SHEET_HEADERS[sheetName]
  if (!expected) throw new Error(`Unknown Feishu sheet: ${sheetName}`)
  if (!Array.isArray(rows) || !Array.isArray(rows[0])) {
    throw new Error(`${sheetName} must contain a header row and tabular rows`)
  }

  const actual = trimTrailingEmptyCells(rows[0]).map(text)
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(
      `${sheetName} header mismatch; expected ${expected.join(',')} but received ${actual.join(',')}`,
    )
  }

  return rows
    .slice(1)
    .filter((row) => Array.isArray(row) && row.some((value) => text(value).length > 0))
    .map((row, rowIndex) => {
      const record = {}
      for (const [index, key] of expected.entries()) {
        record[key] = row[index] ?? ''
      }
      record.__rowNumber = rowIndex + 2
      return record
    })
}

function recordsFor(rawTables, sheetName) {
  const rows = rawTables?.[sheetName]
  return Array.isArray(rows) ? rowsToFeishuRecords(sheetName, rows) : []
}

function mapProjectStatus(value, warnings) {
  return normalizeStatus(
    value,
    {
      进行中: 'active',
      已完成: 'completed',
      完成: 'completed',
      已取消: 'cancelled',
      取消: 'cancelled',
      已关闭: 'completed',
      关闭: 'completed',
      未开始: 'planned',
      计划中: 'planned',
    },
    'active',
    warnings,
    'project.project_status',
  )
}

function mapContractStatus(value, warnings) {
  return normalizeStatus(
    value,
    {
      生效中: 'active',
      生效: 'active',
      已签约: 'active',
      执行中: 'active',
      草稿: 'draft',
      草拟: 'draft',
      已完成: 'completed',
      已终止: 'cancelled',
      已取消: 'cancelled',
      作废: 'cancelled',
    },
    'active',
    warnings,
    'contract.contract_status',
  )
}

function mapInvoiceStatus(value, warnings) {
  return normalizeStatus(
    value,
    {
      已开票: 'issued',
      未结清: 'issued',
      部分收款: 'issued',
      部分结清: 'issued',
      已结清: 'issued',
      已收款: 'issued',
      作废: 'void',
      已作废: 'void',
      草稿: 'draft',
    },
    'issued',
    warnings,
    'invoice.invoice_status',
  )
}

function mapContractType(value, warnings) {
  return normalizeStatus(
    value,
    { 销售: 'sales', 服务: 'service', 框架合同: 'sales', 固定总价: 'service', 其他: 'other' },
    'sales',
    warnings,
    'contract.contract_type',
  )
}

function mapRiskType(value, warnings) {
  return normalizeStatus(
    value,
    { 进度: 'schedule', 成本: 'cost', 范围: 'scope', 需求: 'scope', 其他: 'other' },
    'other',
    warnings,
    'project_risk.risk_type',
  )
}

function mapRiskSeverity(value, warnings) {
  return normalizeStatus(
    value,
    { 高: 'high', 中: 'medium', 低: 'low', 严重: 'critical' },
    'medium',
    warnings,
    'project_risk.risk_level',
  )
}

function mapRiskStatus(value, warnings) {
  return normalizeStatus(
    value,
    { 处理中: 'mitigating', 已识别: 'open', 待处理: 'open', 已关闭: 'closed', 已解决: 'closed' },
    'open',
    warnings,
    'project_risk.risk_status',
  )
}

function mapMilestoneStatus(record) {
  const status = text(record.status)
  if (['已完成', '完成', 'done', 'completed'].includes(status) || text(record.actual_date)) return 'done'
  if (['已取消', '取消', 'cancelled'].includes(status)) return 'cancelled'
  if (['进行中', 'in_progress'].includes(status)) return 'in_progress'
  return 'planned'
}

function mapMetricKey(value, warnings) {
  return normalizeStatus(
    value,
    {
      收入: 'revenue',
      营收: 'revenue',
      毛利: 'gross_profit',
      项目毛利额: 'gross_profit',
      毛利率: 'gross_margin',
      项目毛利率: 'gross_margin',
      回款: 'collection',
      回款额: 'collection',
      应收回款: 'collection',
    },
    text(value).toLowerCase().replaceAll(/\s+/g, '_'),
    warnings,
    'kpi_target.kpi_type',
  )
}

function mapPeriodType(value, warnings) {
  return normalizeStatus(
    value,
    { 年度: 'year', 年: 'year', 月度: 'month', 月: 'month', 季度: 'quarter', 季: 'quarter' },
    text(value).toLowerCase() || 'month',
    warnings,
    'kpi_target.period_type',
  )
}

function mapKpiUnit(value, warnings) {
  return normalizeStatus(
    value,
    { 元: 'amount', 人民币: 'amount', '%': 'ratio', 百分比: 'ratio' },
    text(value) || 'amount',
    warnings,
    'kpi_target.unit',
  )
}

function mapCustomerStatus(value, warnings) {
  return normalizeStatus(
    value,
    { 活跃: 'active', 正常: 'active', 潜在: 'prospect', 休眠: 'inactive', 已流失: 'inactive', 冻结: 'inactive' },
    'active',
    warnings,
    'customer.customer_status',
  )
}

function indexBySourceId(items) {
  return new Map(items.map((item) => [item.sourceId, item]))
}

function groupDuplicateCustomerNames(customers) {
  const grouped = new Map()
  for (const customer of customers) {
    const rows = grouped.get(customer.displayName) ?? []
    rows.push(customer.sourceId)
    grouped.set(customer.displayName, rows)
  }
  return [...grouped.entries()]
    .filter(([, sourceIds]) => sourceIds.length > 1)
    .map(([name, sourceIds]) => ({ name, sourceIds }))
}

export function buildFeishuOperatingLoopPackage(rawTables, options = {}) {
  const mappingWarnings = []
  const source = {
    provider: 'feishu',
    spreadsheetToken: optionalText(options.spreadsheetToken),
    sourceName: optionalText(options.sourceName) ?? '客户经营测试数据包',
    selectedBusinessOrgCode: optionalText(options.selectedBusinessOrgCode),
  }

  const organizations = recordsFor(rawTables, 'organization').map((record) => ({
    sourceId: text(record.org_id),
    name: text(record.org_name),
    parentSourceId: optionalText(record.parent_org_id),
    type: text(record.org_type),
  }))

  const employees = recordsFor(rawTables, 'employee').map((record) => ({
    sourceId: text(record.employee_id),
    displayName: text(record.employee_name),
    description: `${text(record.role)}（来源组织：${text(record.org_id)}）`,
    role: text(record.role),
    status: text(record.status),
    sourceOrgCode: text(record.org_id),
    tags: [sourceTag('employee', text(record.employee_id)), `feishu:org_id=${text(record.org_id)}`],
  }))

  const customers = recordsFor(rawTables, 'customer').map((record) => ({
    sourceId: text(record.customer_id),
    displayName: text(record.customer_name),
    shortName: optionalText(record.customer_short_name),
    industry: optionalText(record.industry),
    level: optionalText(record.customer_level),
    sourceOrgCode: optionalText(record.org_id),
    ownerEmployeeSourceId: optionalText(record.owner_employee_id),
    status: mapCustomerStatus(record.customer_status, mappingWarnings),
    source: sourceReference('customer', text(record.customer_id), `source_record_id=${text(record.source_record_id)}`),
  }))

  const opportunities = recordsFor(rawTables, 'opportunity').map((record) => ({
    sourceId: text(record.opportunity_id),
    name: text(record.opportunity_name),
    customerSourceId: text(record.customer_id),
    sourceOrgCode: text(record.org_id),
    ownerEmployeeSourceId: text(record.owner_employee_id),
    businessCategory: optionalText(record.biz_category),
    productLineCode: optionalText(record.product_line_code),
    stage: optionalText(record.opportunity_stage),
    estimatedAmount: decimalString(record.estimated_amount),
    winProbability: integerNumber(record.win_probability),
    estimatedWinDate: normalizeDate(record.estimated_win_date),
    lastFollowupDate: normalizeDate(record.last_followup_date),
    status: optionalText(record.opportunity_status),
    lossReason: optionalText(record.loss_reason),
    source: sourceTag('opportunity', text(record.opportunity_id)),
  }))

  const followups = recordsFor(rawTables, 'opportunity_followup').map((record) => ({
    sourceId: text(record.followup_id),
    opportunitySourceId: text(record.opportunity_id),
    employeeSourceId: text(record.employee_id),
    date: normalizeDate(record.followup_date),
    content: text(record.followup_content),
    nextPlan: optionalText(record.next_plan),
  }))

  const projects = recordsFor(rawTables, 'project').map((record) => ({
    sourceId: text(record.project_id),
    code: text(record.project_id),
    name: text(record.project_name),
    customerSourceId: text(record.customer_id),
    opportunitySourceId: text(record.opportunity_id),
    sourceOrgCode: text(record.org_id),
    projectManagerSourceId: text(record.project_manager_id),
    productLineCode: optionalText(record.product_line_code),
    stage: optionalText(record.project_stage),
    status: mapProjectStatus(record.project_status, mappingWarnings),
    plannedStartDate: normalizeDate(record.planned_start_date),
    plannedEndDate: normalizeDate(record.planned_end_date),
    actualStartDate: normalizeDate(record.actual_start_date),
    actualEndDate: normalizeDate(record.actual_end_date),
    budgetRevenue: decimalString(record.budget_revenue),
    budgetCost: decimalString(record.budget_cost),
    forecastRevenue: decimalString(record.forecast_revenue),
    forecastCost: decimalString(record.forecast_cost),
    source: sourceTag('project', text(record.project_id)),
  }))

  const milestones = recordsFor(rawTables, 'project_milestone').map((record) => ({
    sourceId: text(record.milestone_id),
    projectSourceId: text(record.project_id),
    name: text(record.milestone_name),
    plannedDate: normalizeDate(record.planned_date),
    actualDate: normalizeDate(record.actual_date),
    status: mapMilestoneStatus(record),
    source: sourceTag('milestone', text(record.milestone_id)),
  }))

  const risks = recordsFor(rawTables, 'project_risk').map((record) => ({
    sourceId: text(record.risk_id),
    projectSourceId: text(record.project_id),
    riskType: mapRiskType(record.risk_type, mappingWarnings),
    severity: mapRiskSeverity(record.risk_level, mappingWarnings),
    description: text(record.risk_description),
    ownerEmployeeSourceId: text(record.owner_employee_id),
    status: mapRiskStatus(record.risk_status, mappingWarnings),
    source: sourceTag('risk', text(record.risk_id)),
  }))

  const contracts = recordsFor(rawTables, 'contract').map((record) => ({
    sourceId: text(record.contract_id),
    code: text(record.contract_id),
    name: text(record.contract_name),
    customerSourceId: text(record.customer_id),
    projectSourceId: text(record.project_id),
    opportunitySourceId: text(record.opportunity_id),
    sourceOrgCode: text(record.org_id),
    type: mapContractType(record.contract_type, mappingWarnings),
    amount: decimalString(record.contract_amount),
    currency: text(record.currency) || 'CNY',
    taxBasis: optionalText(record.tax_basis),
    signDate: normalizeDate(record.sign_date),
    effectiveDate: normalizeDate(record.effective_date),
    expiryDate: normalizeDate(record.expiry_date),
    paymentTerms: optionalText(record.payment_terms),
    status: mapContractStatus(record.contract_status, mappingWarnings),
    source: sourceTag('contract', text(record.contract_id)),
  }))

  const revenues = recordsFor(rawTables, 'project_revenue').map((record) => ({
    sourceId: text(record.revenue_id),
    projectSourceId: text(record.project_id),
    contractSourceId: text(record.contract_id),
    customerSourceId: text(record.customer_id),
    sourceOrgCode: text(record.org_id),
    periodCode: text(record.period_code),
    revenueType: optionalText(record.revenue_type),
    amount: decimalString(record.recognized_revenue),
    currency: text(record.currency) || 'CNY',
    taxBasis: optionalText(record.tax_basis),
    date: normalizeDate(record.recognition_date),
    dataVersion: optionalText(record.data_version),
    source: sourceTag('revenue', text(record.revenue_id)),
  }))

  const costs = recordsFor(rawTables, 'project_cost').map((record) => ({
    sourceId: text(record.cost_id),
    projectSourceId: text(record.project_id),
    contractSourceId: text(record.contract_id),
    customerSourceId: text(record.customer_id),
    sourceOrgCode: text(record.org_id),
    periodCode: text(record.period_code),
    costType: optionalText(record.cost_type),
    amount: decimalString(record.cost_amount),
    directType: optionalText(record.cost_direct_type),
    allocationRule: optionalText(record.allocation_rule),
    currency: text(record.currency) || 'CNY',
    taxBasis: optionalText(record.tax_basis),
    date: normalizeDate(record.cost_date),
    dataVersion: optionalText(record.data_version),
    source: sourceTag('cost', text(record.cost_id)),
  }))

  const invoices = recordsFor(rawTables, 'invoice').map((record) => ({
    sourceId: text(record.invoice_id),
    invoiceNo: text(record.invoice_id),
    contractSourceId: text(record.contract_id),
    projectSourceId: text(record.project_id),
    customerSourceId: text(record.customer_id),
    invoiceDate: normalizeDate(record.invoice_date),
    amount: decimalString(record.invoice_amount),
    currency: text(record.currency) || 'CNY',
    status: mapInvoiceStatus(record.invoice_status, mappingWarnings),
    dueDate: normalizeDate(record.due_date),
    source: sourceTag('invoice', text(record.invoice_id)),
  }))

  const payments = recordsFor(rawTables, 'payment').map((record) => ({
    sourceId: text(record.payment_id),
    paymentNo: text(record.payment_id),
    customerSourceId: text(record.customer_id),
    paymentDate: normalizeDate(record.payment_date),
    amount: decimalString(record.payment_amount),
    currency: text(record.currency) || 'CNY',
    method: optionalText(record.payment_method),
    source: sourceTag('payment', text(record.payment_id)),
  }))

  const allocations = recordsFor(rawTables, 'invoice_payment_relation').map((record) => ({
    sourceId: text(record.relation_id),
    invoiceSourceId: text(record.invoice_id),
    paymentSourceId: text(record.payment_id),
    amount: decimalString(record.allocated_amount),
    date: normalizeDate(record.allocation_date),
    source: sourceTag('allocation', text(record.relation_id)),
  }))

  const allKpiRecords = recordsFor(rawTables, 'kpi_target')
  const kpiRecords = source.selectedBusinessOrgCode
    ? allKpiRecords.filter((record) => text(record.org_object_code) === source.selectedBusinessOrgCode)
    : allKpiRecords
  const kpiTargets = kpiRecords.map((record) => ({
    sourceId: text(record.target_id),
    metricKey: mapMetricKey(record.kpi_type, mappingWarnings),
    sourceOrgType: optionalText(record.org_object_type),
    sourceOrgCode: text(record.org_object_code),
    sourceOrgName: optionalText(record.org_object_name),
    businessCategory: optionalText(record.biz_category),
    periodType: mapPeriodType(record.period_type, mappingWarnings),
    periodCode: text(record.period_code),
    targetValue: decimalString(record.target_value),
    unit: mapKpiUnit(record.unit, mappingWarnings),
    source: sourceTag('kpi_target', text(record.target_id)),
  }))

  return {
    source,
    organizations,
    employees,
    customers,
    opportunities,
    followups,
    projects,
    milestones,
    risks,
    contracts,
    revenues,
    costs,
    invoices,
    payments,
    allocations,
    kpiTargets,
    duplicateCustomerNames: groupDuplicateCustomerNames(customers),
    mappingWarnings,
    sourceCounts: Object.fromEntries(
      Object.entries({
        organization: organizations,
        employee: employees,
        customer: customers,
        opportunity: opportunities,
        opportunity_followup: followups,
        project: projects,
        project_milestone: milestones,
        project_risk: risks,
        contract: contracts,
        project_revenue: revenues,
        project_cost: costs,
        invoice: invoices,
        payment: payments,
        invoice_payment_relation: allocations,
        kpi_target: kpiTargets,
      }).map(([key, items]) => [key, items.length]),
    ),
  }
}

function addMissingReference(errors, code, table, sourceId, field, referencedId) {
  errors.push({
    code,
    table,
    sourceId,
    field,
    referencedId,
  })
}

export function validateFeishuOperatingLoopPackage(pack) {
  const errors = []
  const warnings = [...(pack.mappingWarnings ?? [])]
  const sourceDataConflicts = detectFeishuSourceDataConflicts(pack)
  const organizationIds = new Set(pack.organizations.map((item) => item.sourceId))
  const employeeIds = new Set(pack.employees.map((item) => item.sourceId))
  const customerIds = new Set(pack.customers.map((item) => item.sourceId))
  const opportunityIds = new Set(pack.opportunities.map((item) => item.sourceId))
  const projectIds = new Set(pack.projects.map((item) => item.sourceId))
  const contractIds = new Set(pack.contracts.map((item) => item.sourceId))
  const invoiceIds = new Set(pack.invoices.map((item) => item.sourceId))
  const paymentIds = new Set(pack.payments.map((item) => item.sourceId))

  if (pack.source.selectedBusinessOrgCode && !organizationIds.has(pack.source.selectedBusinessOrgCode)) {
    errors.push({
      code: 'selected_business_org_not_found',
      selectedBusinessOrgCode: pack.source.selectedBusinessOrgCode,
    })
  }

  for (const item of pack.employees) {
    if (item.sourceOrgCode && !organizationIds.has(item.sourceOrgCode)) {
      addMissingReference(errors, 'missing_employee_org', 'employee', item.sourceId, 'org_id', item.sourceOrgCode)
    }
  }
  for (const item of pack.customers) {
    if (item.sourceOrgCode && !organizationIds.has(item.sourceOrgCode)) {
      addMissingReference(errors, 'missing_customer_org', 'customer', item.sourceId, 'org_id', item.sourceOrgCode)
    }
    if (item.ownerEmployeeSourceId && !employeeIds.has(item.ownerEmployeeSourceId)) {
      addMissingReference(errors, 'missing_customer_owner', 'customer', item.sourceId, 'owner_employee_id', item.ownerEmployeeSourceId)
    }
  }
  for (const item of pack.opportunities) {
    if (!customerIds.has(item.customerSourceId)) {
      addMissingReference(errors, 'missing_opportunity_customer', 'opportunity', item.sourceId, 'customer_id', item.customerSourceId)
    }
    if (!employeeIds.has(item.ownerEmployeeSourceId)) {
      addMissingReference(errors, 'missing_opportunity_owner', 'opportunity', item.sourceId, 'owner_employee_id', item.ownerEmployeeSourceId)
    }
  }
  for (const item of pack.followups) {
    if (!opportunityIds.has(item.opportunitySourceId)) {
      addMissingReference(errors, 'missing_followup_opportunity', 'opportunity_followup', item.sourceId, 'opportunity_id', item.opportunitySourceId)
    }
    if (!employeeIds.has(item.employeeSourceId)) {
      addMissingReference(errors, 'missing_followup_employee', 'opportunity_followup', item.sourceId, 'employee_id', item.employeeSourceId)
    }
  }
  for (const item of pack.projects) {
    if (!customerIds.has(item.customerSourceId)) {
      addMissingReference(errors, 'missing_project_customer', 'project', item.sourceId, 'customer_id', item.customerSourceId)
    }
    if (!opportunityIds.has(item.opportunitySourceId)) {
      addMissingReference(errors, 'missing_project_opportunity', 'project', item.sourceId, 'opportunity_id', item.opportunitySourceId)
    }
    if (!employeeIds.has(item.projectManagerSourceId)) {
      addMissingReference(errors, 'missing_project_manager', 'project', item.sourceId, 'project_manager_id', item.projectManagerSourceId)
    }
  }
  for (const item of pack.milestones) {
    if (!projectIds.has(item.projectSourceId)) {
      addMissingReference(errors, 'missing_milestone_project', 'project_milestone', item.sourceId, 'project_id', item.projectSourceId)
    }
  }
  for (const item of pack.risks) {
    if (!projectIds.has(item.projectSourceId)) {
      addMissingReference(errors, 'missing_risk_project', 'project_risk', item.sourceId, 'project_id', item.projectSourceId)
    }
    if (!employeeIds.has(item.ownerEmployeeSourceId)) {
      addMissingReference(errors, 'missing_risk_owner', 'project_risk', item.sourceId, 'owner_employee_id', item.ownerEmployeeSourceId)
    }
  }
  for (const item of pack.contracts) {
    if (!customerIds.has(item.customerSourceId)) {
      addMissingReference(errors, 'missing_contract_customer', 'contract', item.sourceId, 'customer_id', item.customerSourceId)
    }
    if (!projectIds.has(item.projectSourceId)) {
      addMissingReference(errors, 'missing_contract_project', 'contract', item.sourceId, 'project_id', item.projectSourceId)
    }
  }
  for (const [table, item] of [
    ...pack.revenues.map((item) => ['project_revenue', item]),
    ...pack.costs.map((item) => ['project_cost', item]),
  ]) {
    if (!projectIds.has(item.projectSourceId)) {
      addMissingReference(errors, 'missing_finance_project', table, item.sourceId, 'project_id', item.projectSourceId)
    }
    if (!contractIds.has(item.contractSourceId)) {
      addMissingReference(errors, 'missing_finance_contract', table, item.sourceId, 'contract_id', item.contractSourceId)
    }
    if (!customerIds.has(item.customerSourceId)) {
      addMissingReference(errors, 'missing_finance_customer', table, item.sourceId, 'customer_id', item.customerSourceId)
    }
  }
  for (const item of pack.invoices) {
    if (!contractIds.has(item.contractSourceId)) {
      addMissingReference(errors, 'missing_invoice_contract', 'invoice', item.sourceId, 'contract_id', item.contractSourceId)
    }
    if (!projectIds.has(item.projectSourceId)) {
      addMissingReference(errors, 'missing_invoice_project', 'invoice', item.sourceId, 'project_id', item.projectSourceId)
    }
    if (!customerIds.has(item.customerSourceId)) {
      addMissingReference(errors, 'missing_invoice_customer', 'invoice', item.sourceId, 'customer_id', item.customerSourceId)
    }
  }
  for (const item of pack.payments) {
    if (!customerIds.has(item.customerSourceId)) {
      addMissingReference(errors, 'missing_payment_customer', 'payment', item.sourceId, 'customer_id', item.customerSourceId)
    }
  }
  for (const item of pack.allocations) {
    if (!invoiceIds.has(item.invoiceSourceId)) {
      addMissingReference(errors, 'missing_allocation_invoice', 'invoice_payment_relation', item.sourceId, 'invoice_id', item.invoiceSourceId)
    }
    if (!paymentIds.has(item.paymentSourceId)) {
      addMissingReference(errors, 'missing_allocation_payment', 'invoice_payment_relation', item.sourceId, 'payment_id', item.paymentSourceId)
    }
  }

  const kpiOrgCodes = new Set(pack.kpiTargets.map((item) => item.sourceOrgCode))
  if (!pack.source.selectedBusinessOrgCode && kpiOrgCodes.size > 1) {
    errors.push({
      code: 'kpi_dimension_requires_scope',
      sourceOrgCodes: [...kpiOrgCodes].sort(),
      message: 'KPI targets contain multiple business organizations and cannot be represented by the current KPI natural key without an explicit scope.',
    })
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    sourceDataConflicts,
    counts: pack.sourceCounts,
  }
}

export function summarizeFeishuOperatingLoopPackage(pack, validation) {
  return {
    source: pack.source,
    ok: validation.ok,
    counts: validation.counts,
    duplicateCustomerNames: pack.duplicateCustomerNames,
    errors: validation.errors,
    warnings: validation.warnings,
    sourceDataConflicts: validation.sourceDataConflicts ?? [],
    knownSignals: {
      highRisks: pack.risks
        .filter((risk) => risk.severity === 'high' || risk.severity === 'critical')
        .slice(0, 10)
        .map((risk) => ({
          sourceId: risk.sourceId,
          projectSourceId: risk.projectSourceId,
          description: risk.description,
          severity: risk.severity,
        })),
      overdueCandidateInvoices: pack.invoices
        .filter((invoice) => invoice.status === 'issued' && invoice.dueDate && invoice.dueDate < '2026-08-12')
        .slice(0, 10)
        .map((invoice) => ({
          sourceId: invoice.sourceId,
          projectSourceId: invoice.projectSourceId,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
        })),
      scopedKpiTargets: pack.kpiTargets.slice(0, 10).map((target) => ({
        sourceId: target.sourceId,
        metricKey: target.metricKey,
        sourceOrgCode: target.sourceOrgCode,
        periodType: target.periodType,
        periodKey: target.periodCode,
        targetValue: target.targetValue,
        unit: target.unit,
      })),
    },
  }
}

export function detectFeishuSourceDataConflicts(pack) {
  const conflicts = []
  const invoicesBySourceId = new Map(pack.invoices.map((invoice) => [invoice.sourceId, invoice]))
  const paymentsBySourceId = new Map(pack.payments.map((payment) => [payment.sourceId, payment]))
  const runningAllocatedByInvoice = new Map()
  const runningAllocatedByPayment = new Map()
  for (const allocation of pack.allocations) {
    const invoice = invoicesBySourceId.get(allocation.invoiceSourceId)
    const payment = paymentsBySourceId.get(allocation.paymentSourceId)
    const invoiceAmount = invoice ? decimalNumber(invoice.amount) : null
    const paymentAmount = payment ? decimalNumber(payment.amount) : null
    const allocatedAmount = decimalNumber(allocation.amount)
    if (allocatedAmount === null) continue
    if (invoiceAmount !== null) {
      const previous = runningAllocatedByInvoice.get(allocation.invoiceSourceId) ?? 0
      const next = previous + allocatedAmount
      runningAllocatedByInvoice.set(allocation.invoiceSourceId, next)
      if (next > invoiceAmount + 0.000001) {
      conflicts.push({
        code: 'allocation_exceeds_invoice_amount',
        table: 'invoice_payment_relation',
        sourceId: allocation.sourceId,
        invoiceSourceId: allocation.invoiceSourceId,
        paymentSourceId: allocation.paymentSourceId,
        invoiceAmount: invoice.amount,
        allocatedAmount: allocation.amount,
        runningAllocatedAmount: next.toFixed(2),
      })
      }
    }
    if (paymentAmount === null) continue
    const previousPayment = runningAllocatedByPayment.get(allocation.paymentSourceId) ?? 0
    const nextPayment = previousPayment + allocatedAmount
    runningAllocatedByPayment.set(allocation.paymentSourceId, nextPayment)
    if (nextPayment > paymentAmount + 0.000001) {
      conflicts.push({
        code: 'allocation_exceeds_payment_amount',
        table: 'invoice_payment_relation',
        sourceId: allocation.sourceId,
        invoiceSourceId: allocation.invoiceSourceId,
        paymentSourceId: allocation.paymentSourceId,
        paymentAmount: payment.amount,
        allocatedAmount: allocation.amount,
        runningAllocatedAmount: nextPayment.toFixed(2),
      })
    }
  }
  return conflicts
}
