import { test, expect } from '@playwright/test'
import { getAuthToken, apiRequest } from '@helios/core/helpers/integration/api'
import { getTokenContext, expectId } from '@helios/core/helpers/integration/generalFixtures'
import {
  dismissNotificationsByType,
  listNotifications,
} from '@helios/core/helpers/integration/notificationsFixtures'

/**
 * TC-LOOP-001: Full operating loop M5 → M6 → M7
 * project → contract → revenue/cost → invoice → payment → allocation
 * → KPI target/completion → governance rules finding
 */
test.describe('TC-LOOP-001: Operating loop M5→M6→M7', () => {
  test('runs project-to-governance closed loop via APIs', async ({ request }) => {
    const token = await getAuthToken(request, 'admin')
    const { organizationId, tenantId } = getTokenContext(token)
    const suffix = Date.now().toString(36)
    const asOf = '2026-08-31'

    const created: Record<string, string | null> = {
      projectId: null,
      milestoneId: null,
      contractId: null,
      revenueId: null,
      costId: null,
      invoiceId: null,
      paymentId: null,
      allocationId: null,
      kpiTargetId: null,
    }

    try {
      const projectRes = await apiRequest(request, 'POST', '/api/projects/projects', {
        token,
        data: {
          organizationId,
          tenantId,
          name: `LOOP Project ${suffix}`,
          status: 'active',
          budgetCost: '100.00',
          isActive: true,
        },
      })
      expect(projectRes.ok(), await projectRes.text()).toBeTruthy()
      created.projectId = expectId(((await projectRes.json()) as { id?: string }).id, 'project')

      const milestoneRes = await apiRequest(request, 'POST', '/api/projects/milestones', {
        token,
        data: {
          organizationId,
          tenantId,
          projectId: created.projectId,
          name: `LOOP Milestone ${suffix}`,
          status: 'planned',
          plannedDate: '2020-01-01',
        },
      })
      expect(milestoneRes.ok(), await milestoneRes.text()).toBeTruthy()
      created.milestoneId = expectId(((await milestoneRes.json()) as { id?: string }).id, 'milestone')

      const contractRes = await apiRequest(request, 'POST', '/api/commercial/contracts', {
        token,
        data: {
          organizationId,
          tenantId,
          name: `LOOP Contract ${suffix}`,
          projectId: created.projectId,
          amount: '1000.00',
          status: 'active',
          currencyCode: 'CNY',
        },
      })
      expect(contractRes.ok(), await contractRes.text()).toBeTruthy()
      created.contractId = expectId(((await contractRes.json()) as { id?: string }).id, 'contract')

      const revenueRes = await apiRequest(request, 'POST', '/api/commercial/revenues', {
        token,
        data: {
          organizationId,
          tenantId,
          projectId: created.projectId,
          contractId: created.contractId,
          dataVersion: 'actual',
          amount: '500.00',
          recognizedOn: '2026-08-01',
          currencyCode: 'CNY',
        },
      })
      expect(revenueRes.ok(), await revenueRes.text()).toBeTruthy()
      created.revenueId = expectId(((await revenueRes.json()) as { id?: string }).id, 'revenue')

      const costRes = await apiRequest(request, 'POST', '/api/commercial/costs', {
        token,
        data: {
          organizationId,
          tenantId,
          projectId: created.projectId,
          contractId: created.contractId,
          dataVersion: 'actual',
          costType: 'labor',
          amount: '200.00',
          incurredOn: '2026-08-01',
          currencyCode: 'CNY',
        },
      })
      expect(costRes.ok(), await costRes.text()).toBeTruthy()
      created.costId = expectId(((await costRes.json()) as { id?: string }).id, 'cost')

      const invoiceRes = await apiRequest(request, 'POST', '/api/commercial/invoices', {
        token,
        data: {
          organizationId,
          tenantId,
          contractId: created.contractId,
          projectId: created.projectId,
          amount: '500.00',
          status: 'issued',
          issuedOn: '2026-08-01',
          dueDate: '2026-08-10',
          currencyCode: 'CNY',
        },
      })
      expect(invoiceRes.ok(), await invoiceRes.text()).toBeTruthy()
      created.invoiceId = expectId(((await invoiceRes.json()) as { id?: string }).id, 'invoice')

      const paymentRes = await apiRequest(request, 'POST', '/api/commercial/payments', {
        token,
        data: {
          organizationId,
          tenantId,
          amount: '300.00',
          status: 'posted',
          paidOn: '2026-08-12',
          currencyCode: 'CNY',
        },
      })
      expect(paymentRes.ok(), await paymentRes.text()).toBeTruthy()
      created.paymentId = expectId(((await paymentRes.json()) as { id?: string }).id, 'payment')

      const allocationRes = await apiRequest(request, 'POST', '/api/commercial/allocations', {
        token,
        data: {
          organizationId,
          tenantId,
          invoiceId: created.invoiceId,
          paymentId: created.paymentId,
          allocatedAmount: '300.00',
          allocatedOn: '2026-08-12',
        },
      })
      expect(allocationRes.ok(), await allocationRes.text()).toBeTruthy()
      created.allocationId = expectId(((await allocationRes.json()) as { id?: string }).id, 'allocation')

      const metricsRes = await apiRequest(
        request,
        'GET',
        `/api/commercial/metrics?organizationId=${organizationId}&asOf=${asOf}&projectId=${created.projectId}`,
        { token },
      )
      expect(metricsRes.ok(), await metricsRes.text()).toBeTruthy()
      const metrics = (await metricsRes.json()) as {
        actualRevenue?: string
        allocatedPayment?: string
        arOutstanding?: string
      }
      expect(Number(metrics.actualRevenue)).toBeGreaterThan(0)
      expect(Number(metrics.allocatedPayment)).toBe(300)
      expect(Number(metrics.arOutstanding)).toBe(200)

      const kpiRes = await apiRequest(request, 'POST', '/api/insights/kpi-targets', {
        token,
        data: {
          organizationId,
          tenantId,
          metricKey: 'gross_profit',
          unit: 'amount',
          periodType: 'month',
          periodKey: '2026-08',
          targetValue: '300.00',
          currencyCode: 'CNY',
        },
      })
      expect(kpiRes.ok(), await kpiRes.text()).toBeTruthy()
      created.kpiTargetId = expectId(((await kpiRes.json()) as { id?: string }).id, 'kpi')

      const completionRes = await apiRequest(
        request,
        'GET',
        `/api/insights/kpi/completion?organizationId=${organizationId}&periodType=month&periodKey=2026-08&asOf=${asOf}`,
        { token },
      )
      expect(completionRes.ok(), await completionRes.text()).toBeTruthy()
      const completion = (await completionRes.json()) as {
        items?: Array<{
          metricKey?: string
          actualValue?: string | null
          completionRate?: string | null
        }>
      }
      const grossProfitRow = completion.items?.find((row) => row.metricKey === 'gross_profit')
      expect(grossProfitRow).toBeTruthy()
      expect(Number(grossProfitRow?.actualValue)).toBeGreaterThan(0)
      expect(Number(grossProfitRow?.completionRate)).toBeGreaterThan(0)

      const rulesRes = await apiRequest(request, 'POST', '/api/governance/rules/run', {
        token,
        data: { organizationId, tenantId, asOf },
      })
      expect(rulesRes.ok(), await rulesRes.text()).toBeTruthy()
      const rulesBody = (await rulesRes.json()) as { created?: number; updated?: number }
      expect((rulesBody.created ?? 0) + (rulesBody.updated ?? 0)).toBeGreaterThan(0)

      const digestNotifications = await listNotifications(request, token, {
        type: 'governance.rules.digest',
        status: 'unread',
        pageSize: 20,
      })
      const digest = digestNotifications.items.find((item) => item.type === 'governance.rules.digest')
      expect(digest, 'expected governance rules digest notification').toBeTruthy()
      expect(digest).toMatchObject({
        sourceEntityType: 'governance.rules',
        sourceEntityId: organizationId,
        linkHref: '/backend/governance/findings?status=open&severity=critical',
      })

      const findingsRes = await apiRequest(
        request,
        'GET',
        `/api/governance/findings?status=open&pageSize=100`,
        { token },
      )
      expect(findingsRes.ok(), await findingsRes.text()).toBeTruthy()
      const findings = (await findingsRes.json()) as {
        items?: Array<{ ruleId?: string; subjectId?: string; evidenceIds?: unknown }>
      }
      const delayed = findings.items?.find(
        (row) =>
          row.ruleId === 'gov.project_milestone_delayed' && row.subjectId === created.milestoneId,
      )
      const overdue = findings.items?.find(
        (row) =>
          row.ruleId === 'gov.invoice_overdue_outstanding' && row.subjectId === created.invoiceId,
      )
      expect(delayed || overdue, 'expected delayed milestone or overdue invoice finding').toBeTruthy()
    } finally {
      const softDelete = async (path: string, id: string | null) => {
        if (!id) return
        await apiRequest(request, 'DELETE', `${path}?id=${id}`, {
          token,
          data: { id, organizationId, tenantId },
        }).catch(() => undefined)
      }
      await softDelete('/api/commercial/allocations', created.allocationId)
      await softDelete('/api/commercial/payments', created.paymentId)
      await softDelete('/api/commercial/invoices', created.invoiceId)
      await softDelete('/api/commercial/costs', created.costId)
      await softDelete('/api/commercial/revenues', created.revenueId)
      await softDelete('/api/commercial/contracts', created.contractId)
      await softDelete('/api/insights/kpi-targets', created.kpiTargetId)
      await softDelete('/api/projects/milestones', created.milestoneId)
      await softDelete('/api/projects/projects', created.projectId)
      await dismissNotificationsByType(request, token, 'governance.rules.digest')
    }
  })
})
