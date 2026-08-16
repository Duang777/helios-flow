import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EXPECTED_FEISHU_SHEETS,
  buildFeishuOperatingLoopPackage,
  rowsToFeishuRecords,
  validateFeishuOperatingLoopPackage,
} from '../lib/operating-loop-feishu-pack.mjs'

const baseRows = {
  organization: [
    ['org_id', 'org_name', 'parent_org_id', 'org_type'],
    ['REG-A', '华北区域', '', '区域'],
  ],
  employee: [
    ['employee_id', 'employee_name', 'org_id', 'role', 'status'],
    ['EMP-001', '张三', 'REG-A', '项目经理', '在职'],
  ],
  customer: [
    [
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
    ['CUST-0001', '宝马（中国）汽车贸易有限公司', '宝马中国', '汽车', 'A', 'REG-A', 'EMP-001', '活跃', 'CRM-1000'],
    ['CUST-0999', '宝马（中国）汽车贸易有限公司', '宝马中国', '汽车', 'A', 'REG-A', 'EMP-001', '活跃', 'ERP-7788'],
  ],
  opportunity: [
    [
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
    ['OPP-2026-0001', '宝马产线D机会', 'CUST-0001', 'REG-A', 'EMP-001', '新签', 'PL-A', '方案', 5000000, 70, '2026-09-30', '2026-08-01', '进行中', ''],
  ],
  opportunity_followup: [
    ['followup_id', 'opportunity_id', 'employee_id', 'followup_date', 'followup_content', 'next_plan'],
    ['FUP-0001', 'OPP-2026-0001', 'EMP-001', '2026-08-02', '已完成客户现场沟通', '准备合同评审'],
  ],
  project: [
    [
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
    ['PRJ-2026-0001', '宝马-产线D项目交付', 'CUST-0001', 'OPP-2026-0001', 'REG-A', 'EMP-001', 'PL-A', '开发', '进行中', '2026-01-01', '2026-11-30', '2026-01-10', '', 5000000, 3500000, 4800000, 3800000],
  ],
  project_milestone: [
    ['milestone_id', 'project_id', 'milestone_name', 'planned_date', 'actual_date', 'status'],
    ['MS-0001', 'PRJ-2026-0001', '需求冻结', '2026-02-01', '2026-02-03', '已完成'],
  ],
  project_risk: [
    ['risk_id', 'project_id', 'risk_type', 'risk_level', 'risk_description', 'owner_employee_id', 'risk_status'],
    ['RSK-0001', 'PRJ-2026-0001', '进度', '高', '关键里程碑延期', 'EMP-001', '处理中'],
  ],
  contract: [
    [
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
    ['CON-0001', '宝马产线D合同', 'CUST-0001', 'PRJ-2026-0001', 'OPP-2026-0001', 'REG-A', '销售', 5000000, 'CNY', '不含税', '2026-01-01', '2026-01-01', '2026-12-31', '50/50', '生效中'],
  ],
  project_revenue: [
    ['revenue_id', 'project_id', 'contract_id', 'customer_id', 'org_id', 'period_code', 'revenue_type', 'recognized_revenue', 'currency', 'tax_basis', 'recognition_date', 'data_version'],
    ['REV-0001', 'PRJ-2026-0001', 'CON-0001', 'CUST-0001', 'REG-A', '2026-08', '实施收入', 2000000, 'CNY', '不含税', '2026-08-31', 'actual'],
  ],
  project_cost: [
    ['cost_id', 'project_id', 'contract_id', 'customer_id', 'org_id', 'period_code', 'cost_type', 'cost_amount', 'cost_direct_type', 'allocation_rule', 'currency', 'tax_basis', 'cost_date', 'data_version'],
    ['COST-0001', 'PRJ-2026-0001', 'CON-0001', 'CUST-0001', 'REG-A', '2026-08', '人工', 1500000, '直接', '工时', 'CNY', '不含税', '2026-08-31', 'actual'],
  ],
  invoice: [
    ['invoice_id', 'contract_id', 'project_id', 'customer_id', 'invoice_date', 'invoice_amount', 'currency', 'invoice_status', 'due_date'],
    ['INV-00001', 'CON-0001', 'PRJ-2026-0001', 'CUST-0001', '2026-05-10', 35135000, 'CNY', '已开票', '2026-06-10'],
  ],
  payment: [
    ['payment_id', 'customer_id', 'payment_date', 'payment_amount', 'currency', 'payment_method'],
    ['PAY-00001', 'CUST-0001', '2026-06-12', 35135000, 'CNY', '银行转账'],
  ],
  invoice_payment_relation: [
    ['relation_id', 'invoice_id', 'payment_id', 'allocated_amount', 'allocation_date'],
    ['REL-00001', 'INV-00001', 'PAY-00001', 24595000, '2026-06-12'],
  ],
  kpi_target: [
    ['target_id', 'kpi_type', 'org_object_type', 'org_object_code', 'org_object_name', 'biz_category', 'period_type', 'period_code', 'target_value', 'unit'],
    ['TGT-0001', '收入', '区域', 'REG-A', '华北区域', '整体', '年度', '2026', 5000000000, '元'],
    ['TGT-0002', '毛利率', '区域', 'REG-B', '华东区域', '整体', '年度', '2026', 0.35, '%'],
  ],
}

test('rowsToFeishuRecords rejects mismatched headers with actionable detail', () => {
  assert.throws(
    () =>
      rowsToFeishuRecords('customer', [
        ['customer_id', 'customer_name'],
        ['CUST-1', '客户'],
      ]),
    /customer header mismatch/,
  )
})

test('rowsToFeishuRecords accepts Feishu ranges with trailing empty header cells', () => {
  const records = rowsToFeishuRecords('organization', [
    ['org_id', 'org_name', 'parent_org_id', 'org_type', '', ''],
    ['REG-A', '华北区域', '', '区域', '', ''],
  ])

  assert.deepEqual(records, [
    {
      org_id: 'REG-A',
      org_name: '华北区域',
      parent_org_id: '',
      org_type: '区域',
      __rowNumber: 2,
    },
  ])
})

test('buildFeishuOperatingLoopPackage maps source ids, status values, money, and duplicates', () => {
  const pack = buildFeishuOperatingLoopPackage(baseRows, {
    spreadsheetToken: 'sheet-token',
    selectedBusinessOrgCode: 'REG-A',
  })

  assert.equal(EXPECTED_FEISHU_SHEETS.includes('invoice'), true)
  assert.equal(pack.source.spreadsheetToken, 'sheet-token')
  assert.equal(pack.customers[0].sourceId, 'CUST-0001')
  assert.equal(pack.customers[0].source, 'feishu:customer_id=CUST-0001;source_record_id=CRM-1000')
  assert.deepEqual(pack.duplicateCustomerNames, [
    {
      name: '宝马（中国）汽车贸易有限公司',
      sourceIds: ['CUST-0001', 'CUST-0999'],
    },
  ])
  assert.equal(pack.projects[0].status, 'active')
  assert.equal(pack.projects[0].budgetRevenue, '5000000.00')
  assert.equal(pack.milestones[0].status, 'done')
  assert.equal(pack.risks[0].severity, 'high')
  assert.equal(pack.contracts[0].status, 'active')
  assert.equal(pack.invoices[0].status, 'issued')
  assert.equal(pack.kpiTargets.length, 1)
  assert.equal(pack.kpiTargets[0].metricKey, 'revenue')
})

test('validateFeishuOperatingLoopPackage detects missing source references', () => {
  const pack = buildFeishuOperatingLoopPackage(
    {
      ...baseRows,
      project: [
        baseRows.project[0],
        ['PRJ-2026-9999', '孤儿项目', 'CUST-MISSING', 'OPP-MISSING', 'REG-A', 'EMP-MISSING', 'PL-A', '开发', '进行中', '2026-01-01', '2026-11-30', '', '', 1, 1, 1, 1],
      ],
    },
    { selectedBusinessOrgCode: 'REG-A' },
  )

  const validation = validateFeishuOperatingLoopPackage(pack)
  assert.equal(validation.ok, false)
  assert(validation.errors.some((error) => error.code === 'missing_project_customer'))
  assert(validation.errors.some((error) => error.code === 'missing_project_opportunity'))
  assert(validation.errors.some((error) => error.code === 'missing_project_manager'))
})

test('validateFeishuOperatingLoopPackage requires explicit KPI source org when dimensions would collapse', () => {
  const pack = buildFeishuOperatingLoopPackage(baseRows)
  const validation = validateFeishuOperatingLoopPackage(pack)

  assert.equal(validation.ok, false)
  assert(validation.errors.some((error) => error.code === 'kpi_dimension_requires_scope'))
})

test('validateFeishuOperatingLoopPackage reports allocation source-data conflicts separately', () => {
  const pack = buildFeishuOperatingLoopPackage(
    {
      ...baseRows,
      invoice_payment_relation: [
        baseRows.invoice_payment_relation[0],
        ['REL-00001', 'INV-00001', 'PAY-00001', 24595000, '2026-06-12'],
        ['REL-00002', 'INV-00001', 'PAY-00001', 20000000, '2026-06-13'],
      ],
    },
    { selectedBusinessOrgCode: 'REG-A' },
  )
  const validation = validateFeishuOperatingLoopPackage(pack)

  assert.equal(validation.ok, true)
  assert(
    validation.sourceDataConflicts.some(
      (conflict) => conflict.code === 'allocation_exceeds_invoice_amount' && conflict.sourceId === 'REL-00002',
    ),
  )
})

test('validateFeishuOperatingLoopPackage reports payment over-allocation conflicts', () => {
  const pack = buildFeishuOperatingLoopPackage(
    {
      ...baseRows,
      payment: [
        baseRows.payment[0],
        ['PAY-00001', 'CUST-0001', '2026-06-12', 30000000, 'CNY', '银行转账'],
      ],
      invoice_payment_relation: [
        baseRows.invoice_payment_relation[0],
        ['REL-00001', 'INV-00001', 'PAY-00001', 24595000, '2026-06-12'],
        ['REL-00002', 'INV-00001', 'PAY-00001', 10000000, '2026-06-13'],
      ],
    },
    { selectedBusinessOrgCode: 'REG-A' },
  )
  const validation = validateFeishuOperatingLoopPackage(pack)

  assert.equal(validation.ok, true)
  assert(validation.sourceDataConflicts.some((conflict) => conflict.code === 'allocation_exceeds_payment_amount'))
})
