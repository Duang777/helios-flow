import assert from 'node:assert/strict'
import test from 'node:test'

import { buildFeishuOperatingLoopPackage } from '../lib/operating-loop-feishu-pack.mjs'
import {
  buildFeishuWritePayloads,
  importFeishuOperatingLoopPackage,
} from '../lib/operating-loop-feishu-writer.mjs'

const scope = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
}

const rows = {
  organization: [
    ['org_id', 'org_name', 'parent_org_id', 'org_type'],
    ['REG-A', '华北区域', '', '区域'],
  ],
  employee: [
    ['employee_id', 'employee_name', 'org_id', 'role', 'status'],
    ['EMP-001', '张三', 'REG-A', '项目经理', '在职'],
  ],
  customer: [
    ['customer_id', 'customer_name', 'customer_short_name', 'industry', 'customer_level', 'org_id', 'owner_employee_id', 'customer_status', 'source_record_id'],
    ['CUST-0001', '宝马（中国）汽车贸易有限公司', '宝马中国', '汽车', 'A', 'REG-A', 'EMP-001', '活跃', 'CRM-1000'],
  ],
  opportunity: [
    ['opportunity_id', 'opportunity_name', 'customer_id', 'org_id', 'owner_employee_id', 'biz_category', 'product_line_code', 'opportunity_stage', 'estimated_amount', 'win_probability', 'estimated_win_date', 'last_followup_date', 'opportunity_status', 'loss_reason'],
    ['OPP-2026-0001', '宝马产线D机会', 'CUST-0001', 'REG-A', 'EMP-001', '新签', 'PL-A', '方案', 5000000, 70, '2026-09-30', '2026-08-01', '进行中', ''],
  ],
  opportunity_followup: [
    ['followup_id', 'opportunity_id', 'employee_id', 'followup_date', 'followup_content', 'next_plan'],
    ['FUP-0001', 'OPP-2026-0001', 'EMP-001', '2026-08-02', '已完成客户现场沟通', '准备合同评审'],
  ],
  project: [
    ['project_id', 'project_name', 'customer_id', 'opportunity_id', 'org_id', 'project_manager_id', 'product_line_code', 'project_stage', 'project_status', 'planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date', 'budget_revenue', 'budget_cost', 'forecast_revenue', 'forecast_cost'],
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
    ['contract_id', 'contract_name', 'customer_id', 'project_id', 'opportunity_id', 'org_id', 'contract_type', 'contract_amount', 'currency', 'tax_basis', 'sign_date', 'effective_date', 'expiry_date', 'payment_terms', 'contract_status'],
    ['CON-0001', '宝马产线D合同', 'CUST-0001', 'PRJ-2026-0001', 'OPP-2026-0001', 'REG-A', '框架合同', 5000000, 'CNY', '不含税', '2026-01-01', '2026-01-01', '2026-12-31', '50/50', '生效'],
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
    ['TGT-0001', '项目毛利率', '区域', 'REG-A', '华北区域', '整体', '年', '2026', 0.35, '%'],
  ],
}

function createPack() {
  return buildFeishuOperatingLoopPackage(rows, { selectedBusinessOrgCode: 'REG-A' })
}

test('buildFeishuWritePayloads uses filled reference maps for dependent payloads', () => {
  const pack = createPack()
  const refs = {
    employees: new Map([['EMP-001', 'emp-uuid']]),
    customers: new Map([['CUST-0001', 'cust-uuid']]),
    opportunities: new Map([['OPP-2026-0001', 'deal-uuid']]),
    projects: new Map([['PRJ-2026-0001', 'project-uuid']]),
    contracts: new Map([['CON-0001', 'contract-uuid']]),
    invoices: new Map([['INV-00001', 'invoice-uuid']]),
    payments: new Map([['PAY-00001', 'payment-uuid']]),
  }
  const payloads = buildFeishuWritePayloads(pack, scope, refs)

  assert.equal(payloads.projects[0].payload.customerEntityId, 'cust-uuid')
  assert.equal(payloads.projects[0].payload.dealId, 'deal-uuid')
  assert.equal(payloads.projects[0].payload.projectManagerId, 'emp-uuid')
  assert.equal(payloads.invoices[0].payload.contractId, 'contract-uuid')
  assert.equal(payloads.allocations[0].payload.invoiceId, 'invoice-uuid')
  assert.equal(payloads.kpiTargets[0].payload.targetValue, '35.00')
})

test('importFeishuOperatingLoopPackage writes dependent records after references exist', async () => {
  const pack = createPack()
  const posts = []
  let sequence = 0
  const api = async (path, init = {}) => {
    if (!init.method) return { items: [], totalPages: 1 }
    sequence += 1
    const payload = JSON.parse(init.body)
    posts.push({ path, payload })
    return { id: `${path.split('/').pop()}-${sequence}` }
  }

  const result = await importFeishuOperatingLoopPackage({
    api,
    pack,
    scope,
    concurrency: 1,
    logger: { log() {} },
  })

  assert.equal(result.failed.length, 0)
  const project = posts.find((entry) => entry.path === '/api/projects/projects')
  const contract = posts.find((entry) => entry.path === '/api/commercial/contracts')
  const allocation = posts.find((entry) => entry.path === '/api/commercial/allocations')
  assert.equal(project.payload.customerEntityId, 'companies-2')
  assert.equal(project.payload.dealId, 'deals-3')
  assert.equal(project.payload.projectManagerId, 'team-members-1')
  assert.equal(contract.payload.projectId, 'projects-5')
  assert.equal(allocation.payload.invoiceId, result.references.invoices.get('INV-00001'))
  assert.equal(allocation.payload.paymentId, result.references.payments.get('PAY-00001'))
})

test('importFeishuOperatingLoopPackage updates KPI natural-key matches and skips invalid allocations', async () => {
  const pack = createPack()
  pack.allocations.push({
    ...pack.allocations[0],
    sourceId: 'REL-00002',
    amount: '20000000.00',
    date: '2026-06-13',
  })
  const posts = []
  const puts = []
  let sequence = 0
  const api = async (path, init = {}) => {
    if (!init.method) {
      if (path.startsWith('/api/insights/kpi-targets')) {
        return {
          items: [
            {
              id: 'existing-kpi-target',
              metricKey: 'gross_margin',
              periodType: 'year',
              periodKey: '2026',
              note: null,
            },
          ],
          totalPages: 1,
        }
      }
      return { items: [], totalPages: 1 }
    }
    const payload = JSON.parse(init.body)
    if (init.method === 'PUT') {
      puts.push({ path, payload })
      return { ok: true }
    }
    sequence += 1
    posts.push({ path, payload })
    return { id: `${path.split('/').pop()}-${sequence}` }
  }

  const result = await importFeishuOperatingLoopPackage({
    api,
    pack,
    scope,
    concurrency: 1,
    logger: { log() {} },
  })

  assert.equal(result.failed.length, 0)
  assert.equal(result.skipped.length, 1)
  assert(result.skipped.some((item) => item.entity === 'allocations' && item.sourceId === 'REL-00002'))
  assert.equal(puts.length, 1)
  assert.equal(puts[0].path, '/api/insights/kpi-targets')
  assert.equal(puts[0].payload.id, 'existing-kpi-target')
  assert.equal(puts[0].payload.targetValue, '35.00')
})

test('importFeishuOperatingLoopPackage treats existing-state allocation conflicts as skipped', async () => {
  const pack = createPack()
  const api = async (path, init = {}) => {
    if (!init.method) return { items: [], totalPages: 1 }
    const payload = JSON.parse(init.body)
    if (path === '/api/commercial/allocations') {
      throw new Error('POST /api/commercial/allocations failed (400): {"error":"Total allocation exceeds payment amount"}')
    }
    return { id: `${path.split('/').pop()}-${payload.invoiceNo ?? payload.paymentNo ?? payload.code ?? payload.source ?? payload.displayName ?? 'id'}` }
  }

  const result = await importFeishuOperatingLoopPackage({
    api,
    pack,
    scope,
    concurrency: 1,
    logger: { log() {} },
  })

  assert.equal(result.failed.length, 0)
  assert(result.skipped.some((item) => item.entity === 'allocations' && item.sourceId === 'REL-00001'))
})
