export const FEISHU_OPERATING_LOOP_COMPANY_NAME = '北京四维图新科技股份有限公司'

export const FEISHU_OPERATING_LOOP_VERIFY_EXPECTATIONS = {
  companyName: FEISHU_OPERATING_LOOP_COMPANY_NAME,
  duplicateCustomerSourceIds: ['CUST-0001', 'CUST-0999'],
  overdueInvoiceSourceIds: ['INV-00001', 'INV-00002'],
  delayedRiskSourceIds: ['RSK-0003', 'RSK-0006', 'RSK-0010', 'RSK-0015'],
}

function sourceIdFrom(value, prefix) {
  const text = typeof value === 'string' ? value : ''
  const index = text.indexOf(prefix)
  return index >= 0 ? text.slice(index + prefix.length).split(';')[0].split(']')[0] : null
}

function sourceIdFromRow(row, prefixes) {
  for (const [field, prefix] of prefixes) {
    const id = sourceIdFrom(row?.[field], prefix)
    if (id) return id
  }
  return null
}

function failure(code, message, details = {}) {
  return { code, message, details }
}

export function evaluateFeishuOperatingLoopVerification(input, expectations = FEISHU_OPERATING_LOOP_VERIFY_EXPECTATIONS) {
  const failures = []
  const organizationName = typeof input.organization?.name === 'string' ? input.organization.name.trim() : ''
  if (organizationName !== expectations.companyName) {
    failures.push(
      failure('company_name_mismatch', 'Expected the running organization to match the Feishu package company subject.', {
        expected: expectations.companyName,
        actual: organizationName || null,
      }),
    )
  }

  const customersBySource = new Map(
    input.customers
      .map((row) => [
        sourceIdFromRow(row, [
          ['source', 'feishu:customer_id='],
          ['description', 'feishu:customer_id='],
        ]),
        row,
      ])
      .filter(([sourceId]) => sourceId),
  )
  const duplicateCustomers = expectations.duplicateCustomerSourceIds
    .map((sourceId) => customersBySource.get(sourceId))
    .filter(Boolean)
  if (duplicateCustomers.length < 2) {
    failures.push(
      failure('duplicate_customer_missing', 'Expected both duplicate BMW customer source records in Helios.', {
        expectedSourceIds: expectations.duplicateCustomerSourceIds,
        foundSourceIds: duplicateCustomers.map((row) => sourceIdFromRow(row, [['source', 'feishu:customer_id=']])),
      }),
    )
  }

  const invoiceSourceIds = new Set(input.invoices.map((row) => row?.invoiceNo).filter(Boolean))
  const missingOverdueInvoices = expectations.overdueInvoiceSourceIds.filter((sourceId) => !invoiceSourceIds.has(sourceId))
  if (missingOverdueInvoices.length > 0) {
    failures.push(
      failure('overdue_invoice_missing', 'Expected overdue invoice source records in Helios.', {
        missingSourceIds: missingOverdueInvoices,
      }),
    )
  }

  const riskSourceIds = new Set(
    input.risks
      .map((row) => sourceIdFromRow(row, [['description', 'feishu:risk_id=']]))
      .filter(Boolean),
  )
  const missingRisks = expectations.delayedRiskSourceIds.filter((sourceId) => !riskSourceIds.has(sourceId))
  if (missingRisks.length > 0) {
    failures.push(
      failure('delayed_risk_missing', 'Expected high milestone-delay risk source records in Helios.', {
        missingSourceIds: missingRisks,
      }),
    )
  }

  const digest = input.digest
  const metrics = digest?.metrics ?? {}
  const groupCounts = Object.fromEntries(
    Object.entries(digest?.groups ?? {}).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0]),
  )
  if (Number(metrics.kpiGapCount ?? 0) < 1 || groupCounts.kpiGaps < 1) {
    failures.push(
      failure('kpi_gap_missing', 'Expected at least one KPI target gap in the operating-loop digest.', {
        kpiGapCount: metrics.kpiGapCount ?? 0,
        kpiGroupCount: groupCounts.kpiGaps ?? 0,
      }),
    )
  }

  for (const groupKey of ['criticalFindings', 'overdueInvoices', 'delayedProjects', 'kpiGaps']) {
    if (digest?.sourceStatus?.[groupKey]?.ok !== true) {
      failures.push(
        failure('digest_source_failed', `Operating-loop digest source ${groupKey} is not healthy.`, {
          status: digest?.sourceStatus?.[groupKey] ?? null,
        }),
      )
    }
  }

  const proactiveNotification = input.notifications.find(
    (notification) =>
      notification?.type === 'insights.operating_loop.digest' &&
      notification?.linkHref === '/backend/insights/operating-loop/today',
  )
  if (!proactiveNotification) {
    failures.push(
      failure('proactive_digest_notification_missing', 'Expected a proactive digest notification linking to today summary.', {
        notificationCount: input.notifications.length,
      }),
    )
  }

  return {
    ok: failures.length === 0,
    failures,
    metrics: {
      duplicateCustomerCount: duplicateCustomers.length,
      importedInvoiceCount: invoiceSourceIds.size,
      importedRiskCount: riskSourceIds.size,
      expectedDelayedRiskCount: expectations.delayedRiskSourceIds.length,
      companyName: organizationName || null,
      digestMetrics: metrics,
      digestGroupCounts: groupCounts,
      proactiveDigestNotification: proactiveNotification
        ? { id: proactiveNotification.id, linkHref: proactiveNotification.linkHref }
        : null,
    },
  }
}
