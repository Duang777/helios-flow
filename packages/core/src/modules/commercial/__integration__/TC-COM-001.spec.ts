import { test, expect } from '@playwright/test'
import { getAuthToken, apiRequest } from '@helios/core/helpers/integration/api'
import { getTokenContext, expectId } from '@helios/core/helpers/integration/generalFixtures'

/**
 * TC-COM-001: Commercial settlement chain (contract → invoice → payment → allocate)
 * Source: .ai/specs/2026-08-08-commercial-settlement-module.md
 */
test.describe('TC-COM-001: Commercial settlement chain', () => {
  test('creates contract, invoice, payment, allocates, rejects over-allocation, reads metrics', async ({
    request,
  }) => {
    const token = await getAuthToken(request, 'admin')
    const { organizationId, tenantId } = getTokenContext(token)
    const suffix = Date.now().toString(36)

    let projectId: string | null = null
    let contractId: string | null = null
    let invoiceId: string | null = null
    let paymentId: string | null = null
    let allocationId: string | null = null

    try {
      const createProject = await apiRequest(request, 'POST', '/api/projects/projects', {
        token,
        data: {
          organizationId,
          tenantId,
          name: `QA COM Project ${suffix}`,
          status: 'active',
          isActive: true,
        },
      })
      expect(createProject.ok(), `create project failed: ${createProject.status()}`).toBeTruthy()
      const createdProject = (await createProject.json()) as { id?: string }
      projectId = expectId(createdProject.id, 'project id missing')

      const createContract = await apiRequest(request, 'POST', '/api/commercial/contracts', {
        token,
        data: {
          organizationId,
          tenantId,
          name: `QA Contract ${suffix}`,
          projectId,
          amount: '1000.00',
          status: 'active',
          currencyCode: 'CNY',
        },
      })
      expect(createContract.ok(), `create contract failed: ${createContract.status()}`).toBeTruthy()
      const createdContract = (await createContract.json()) as { id?: string }
      contractId = expectId(createdContract.id, 'contract id missing')

      const createInvoice = await apiRequest(request, 'POST', '/api/commercial/invoices', {
        token,
        data: {
          organizationId,
          tenantId,
          contractId,
          projectId,
          amount: '600.00',
          status: 'issued',
          issuedOn: '2026-08-01',
          dueDate: '2026-08-15',
          currencyCode: 'CNY',
        },
      })
      expect(createInvoice.ok(), `create invoice failed: ${createInvoice.status()}`).toBeTruthy()
      const createdInvoice = (await createInvoice.json()) as { id?: string }
      invoiceId = expectId(createdInvoice.id, 'invoice id missing')

      const createPayment = await apiRequest(request, 'POST', '/api/commercial/payments', {
        token,
        data: {
          organizationId,
          tenantId,
          amount: '800.00',
          status: 'posted',
          paidOn: '2026-08-10',
          currencyCode: 'CNY',
        },
      })
      expect(createPayment.ok(), `create payment failed: ${createPayment.status()}`).toBeTruthy()
      const createdPayment = (await createPayment.json()) as { id?: string }
      paymentId = expectId(createdPayment.id, 'payment id missing')

      const createAllocation = await apiRequest(request, 'POST', '/api/commercial/allocations', {
        token,
        data: {
          organizationId,
          tenantId,
          invoiceId,
          paymentId,
          allocatedAmount: '400.00',
          allocatedOn: '2026-08-10',
        },
      })
      expect(createAllocation.ok(), `create allocation failed: ${createAllocation.status()}`).toBeTruthy()
      const createdAllocation = (await createAllocation.json()) as { id?: string }
      allocationId = expectId(createdAllocation.id, 'allocation id missing')

      const overAlloc = await apiRequest(request, 'POST', '/api/commercial/allocations', {
        token,
        data: {
          organizationId,
          tenantId,
          invoiceId,
          paymentId,
          allocatedAmount: '300.00',
        },
      })
      expect(overAlloc.status()).toBe(400)

      const metrics = await apiRequest(
        request,
        'GET',
        `/api/commercial/metrics?organizationId=${organizationId}&contractId=${contractId}&asOf=2026-08-31`,
        { token },
      )
      expect(metrics.ok(), `metrics failed: ${metrics.status()}`).toBeTruthy()
      const metricsBody = (await metrics.json()) as {
        allocatedPayment?: string
        collectionRate?: string | null
        invoiceRate?: string | null
        definitions?: Record<string, unknown>
      }
      expect(metricsBody.allocatedPayment).toBe('400.00')
      expect(metricsBody.collectionRate).toBeTruthy()
      expect(metricsBody.invoiceRate).toBeTruthy()
      expect(metricsBody.definitions?.allocatedPayment).toBeTruthy()
    } finally {
      if (allocationId) {
        await apiRequest(request, 'DELETE', `/api/commercial/allocations?id=${allocationId}`, { token })
      }
      if (paymentId) {
        await apiRequest(request, 'DELETE', `/api/commercial/payments?id=${paymentId}`, { token })
      }
      if (invoiceId) {
        await apiRequest(request, 'DELETE', `/api/commercial/invoices?id=${invoiceId}`, { token })
      }
      if (contractId) {
        await apiRequest(request, 'DELETE', `/api/commercial/contracts?id=${contractId}`, { token })
      }
      if (projectId) {
        await apiRequest(request, 'DELETE', `/api/projects/projects?id=${projectId}`, { token })
      }
    }
  })
})
