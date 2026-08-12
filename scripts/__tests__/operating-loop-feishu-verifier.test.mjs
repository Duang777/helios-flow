import assert from 'node:assert/strict'
import test from 'node:test'

import {
  evaluateFeishuOperatingLoopVerification,
} from '../lib/operating-loop-feishu-verifier.mjs'

const baseInput = {
  customers: [
    { source: 'feishu:customer_id=CUST-0001;org_id=REG-A', displayName: '宝马（中国）汽车贸易有限公司' },
    { source: 'feishu:customer_id=CUST-0999;org_id=REG-A', displayName: '宝马（中国）汽车贸易有限公司' },
  ],
  invoices: [
    { invoiceNo: 'INV-00001', status: 'issued' },
    { invoiceNo: 'INV-00002', status: 'issued' },
  ],
  risks: [
    { description: '延期风险；feishu:risk_id=RSK-0003;org_id=REG-A' },
    { description: '延期风险；feishu:risk_id=RSK-0006;org_id=REG-A' },
    { description: '延期风险；feishu:risk_id=RSK-0010;org_id=REG-A' },
    { description: '延期风险；feishu:risk_id=RSK-0015;org_id=REG-A' },
  ],
  digest: {
    metrics: {
      criticalFindingCount: 7,
      delayedProjectCount: 6,
      overdueInvoiceCount: 29,
      overdueOutstanding: '427903300.00',
      kpiGapCount: 3,
    },
    groups: {
      criticalFindings: [{}],
      overdueInvoices: [{}],
      delayedProjects: [{}],
      kpiGaps: [{}],
    },
    sourceStatus: {
      criticalFindings: { ok: true },
      overdueInvoices: { ok: true },
      delayedProjects: { ok: true },
      kpiGaps: { ok: true },
    },
  },
  notifications: [
    {
      id: 'notification-1',
      type: 'insights.operating_loop.digest',
      linkHref: '/backend/insights/operating-loop/today',
    },
  ],
}

test('accepts the five real operating-loop business signals', () => {
  const result = evaluateFeishuOperatingLoopVerification(baseInput)

  assert.equal(result.ok, true)
  assert.deepEqual(result.failures, [])
  assert.equal(result.metrics.duplicateCustomerCount, 2)
  assert.equal(result.metrics.digestMetrics.kpiGapCount, 3)
  assert.deepEqual(result.metrics.proactiveDigestNotification, {
    id: 'notification-1',
    linkHref: '/backend/insights/operating-loop/today',
  })
})

test('reports missing signals instead of passing with incomplete data', () => {
  const result = evaluateFeishuOperatingLoopVerification({
    ...baseInput,
    customers: [baseInput.customers[0]],
    invoices: [],
    risks: [],
    digest: {
      ...baseInput.digest,
      metrics: { ...baseInput.digest.metrics, kpiGapCount: 0 },
      groups: { ...baseInput.digest.groups, kpiGaps: [] },
      sourceStatus: { ...baseInput.digest.sourceStatus, delayedProjects: { ok: false, message: 'source down' } },
    },
    notifications: [],
  })

  assert.equal(result.ok, false)
  assert.deepEqual(
    result.failures.map((failure) => failure.code),
    [
      'duplicate_customer_missing',
      'overdue_invoice_missing',
      'delayed_risk_missing',
      'kpi_gap_missing',
      'digest_source_failed',
      'proactive_digest_notification_missing',
    ],
  )
})
