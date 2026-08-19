import { z } from 'zod'

const moneySchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a non-negative decimal with up to 2 places')

const optionalMoneySchema = moneySchema.nullable().optional()

const contractStatusSchema = z.enum(['draft', 'active', 'completed', 'cancelled'])
const contractTypeSchema = z.enum(['sales', 'service', 'other'])
const invoiceStatusSchema = z.enum(['draft', 'issued', 'void'])
const paymentStatusSchema = z.enum(['draft', 'posted', 'void'])
const costTypeSchema = z.enum(['labor', 'purchase', 'outsourcing', 'other'])
const dataVersionSchema = z.literal('actual')

export const contractCreateSchema = z.object({
  organizationId: z.uuid(),
  tenantId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().max(64).nullable().optional(),
  status: contractStatusSchema.optional(),
  contractType: contractTypeSchema.optional(),
  customerEntityId: z.uuid().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  dealId: z.uuid().nullable().optional(),
  amount: moneySchema,
  currencyCode: z.string().trim().max(8).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  paymentTerms: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

export const contractUpdateSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
  tenantId: z.uuid().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  code: z.string().trim().max(64).nullable().optional(),
  status: contractStatusSchema.optional(),
  contractType: contractTypeSchema.optional(),
  customerEntityId: z.uuid().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  dealId: z.uuid().nullable().optional(),
  amount: moneySchema.optional(),
  currencyCode: z.string().trim().max(8).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  paymentTerms: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

export const contractDeleteSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const revenueCreateSchema = z.object({
  organizationId: z.uuid(),
  tenantId: z.uuid(),
  projectId: z.uuid(),
  contractId: z.uuid().nullable().optional(),
  dataVersion: dataVersionSchema.optional(),
  amount: moneySchema,
  currencyCode: z.string().trim().max(8).optional(),
  recognizedOn: z.string().min(1),
  note: z.string().trim().max(4000).nullable().optional(),
  isActive: z.boolean().optional(),
})

export const revenueUpdateSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
  tenantId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  contractId: z.uuid().nullable().optional(),
  dataVersion: dataVersionSchema.optional(),
  amount: moneySchema.optional(),
  currencyCode: z.string().trim().max(8).optional(),
  recognizedOn: z.string().optional(),
  note: z.string().trim().max(4000).nullable().optional(),
  isActive: z.boolean().optional(),
})

export const revenueDeleteSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const costCreateSchema = z.object({
  organizationId: z.uuid(),
  tenantId: z.uuid(),
  projectId: z.uuid(),
  contractId: z.uuid().nullable().optional(),
  dataVersion: dataVersionSchema.optional(),
  costType: costTypeSchema.optional(),
  amount: moneySchema,
  currencyCode: z.string().trim().max(8).optional(),
  incurredOn: z.string().min(1),
  note: z.string().trim().max(4000).nullable().optional(),
  isActive: z.boolean().optional(),
})

export const costUpdateSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
  tenantId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  contractId: z.uuid().nullable().optional(),
  dataVersion: dataVersionSchema.optional(),
  costType: costTypeSchema.optional(),
  amount: moneySchema.optional(),
  currencyCode: z.string().trim().max(8).optional(),
  incurredOn: z.string().optional(),
  note: z.string().trim().max(4000).nullable().optional(),
  isActive: z.boolean().optional(),
})

export const costDeleteSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const invoiceCreateSchema = z.object({
  organizationId: z.uuid(),
  tenantId: z.uuid(),
  contractId: z.uuid().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  customerEntityId: z.uuid().nullable().optional(),
  invoiceNo: z.string().trim().max(64).nullable().optional(),
  status: invoiceStatusSchema.optional(),
  amount: moneySchema,
  currencyCode: z.string().trim().max(8).optional(),
  issuedOn: z.string().min(1),
  dueDate: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const invoiceUpdateSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
  tenantId: z.uuid().optional(),
  contractId: z.uuid().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  customerEntityId: z.uuid().nullable().optional(),
  invoiceNo: z.string().trim().max(64).nullable().optional(),
  status: invoiceStatusSchema.optional(),
  amount: moneySchema.optional(),
  currencyCode: z.string().trim().max(8).optional(),
  issuedOn: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const invoiceDeleteSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const paymentCreateSchema = z.object({
  organizationId: z.uuid(),
  tenantId: z.uuid(),
  customerEntityId: z.uuid().nullable().optional(),
  paymentNo: z.string().trim().max(64).nullable().optional(),
  status: paymentStatusSchema.optional(),
  amount: moneySchema,
  currencyCode: z.string().trim().max(8).optional(),
  paidOn: z.string().min(1),
  isActive: z.boolean().optional(),
})

export const paymentUpdateSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
  tenantId: z.uuid().optional(),
  customerEntityId: z.uuid().nullable().optional(),
  paymentNo: z.string().trim().max(64).nullable().optional(),
  status: paymentStatusSchema.optional(),
  amount: moneySchema.optional(),
  currencyCode: z.string().trim().max(8).optional(),
  paidOn: z.string().optional(),
  isActive: z.boolean().optional(),
})

export const paymentDeleteSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const allocationCreateSchema = z.object({
  organizationId: z.uuid(),
  tenantId: z.uuid(),
  invoiceId: z.uuid(),
  paymentId: z.uuid(),
  allocatedAmount: moneySchema,
  allocatedOn: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const allocationUpdateSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
  tenantId: z.uuid().optional(),
  invoiceId: z.uuid().optional(),
  paymentId: z.uuid().optional(),
  allocatedAmount: moneySchema.optional(),
  allocatedOn: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const allocationDeleteSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export type ContractCreateInput = z.infer<typeof contractCreateSchema>
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>
export type ContractDeleteInput = z.infer<typeof contractDeleteSchema>
export type RevenueCreateInput = z.infer<typeof revenueCreateSchema>
export type RevenueUpdateInput = z.infer<typeof revenueUpdateSchema>
export type RevenueDeleteInput = z.infer<typeof revenueDeleteSchema>
export type CostCreateInput = z.infer<typeof costCreateSchema>
export type CostUpdateInput = z.infer<typeof costUpdateSchema>
export type CostDeleteInput = z.infer<typeof costDeleteSchema>
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>
export type InvoiceDeleteInput = z.infer<typeof invoiceDeleteSchema>
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>
export type PaymentDeleteInput = z.infer<typeof paymentDeleteSchema>
export type AllocationCreateInput = z.infer<typeof allocationCreateSchema>
export type AllocationUpdateInput = z.infer<typeof allocationUpdateSchema>
export type AllocationDeleteInput = z.infer<typeof allocationDeleteSchema>

export { optionalMoneySchema }
