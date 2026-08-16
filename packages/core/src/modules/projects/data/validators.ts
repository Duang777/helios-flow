import { z } from 'zod'

const moneySchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a non-negative decimal with up to 2 places')
  .nullable()
  .optional()

const projectStatusSchema = z.enum(['draft', 'active', 'on_hold', 'completed', 'cancelled'])
const milestoneStatusSchema = z.enum(['planned', 'in_progress', 'done', 'cancelled'])
const riskTypeSchema = z.enum(['schedule', 'cost', 'scope', 'other'])
const riskStatusSchema = z.enum(['open', 'mitigating', 'closed'])

export const projectCreateSchema = z.object({
  organizationId: z.uuid(),
  tenantId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().max(64).nullable().optional(),
  status: projectStatusSchema.optional(),
  customerEntityId: z.uuid().nullable().optional(),
  dealId: z.uuid().nullable().optional(),
  projectManagerId: z.uuid().nullable().optional(),
  productLineCode: z.string().trim().max(64).nullable().optional(),
  bizCategory: z.string().trim().max(64).nullable().optional(),
  budgetRevenue: moneySchema,
  budgetCost: moneySchema,
  forecastRevenue: moneySchema,
  forecastCost: moneySchema,
  isActive: z.boolean().optional(),
})

export const projectUpdateSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
  tenantId: z.uuid().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  code: z.string().trim().max(64).nullable().optional(),
  status: projectStatusSchema.optional(),
  customerEntityId: z.uuid().nullable().optional(),
  dealId: z.uuid().nullable().optional(),
  projectManagerId: z.uuid().nullable().optional(),
  productLineCode: z.string().trim().max(64).nullable().optional(),
  bizCategory: z.string().trim().max(64).nullable().optional(),
  budgetRevenue: moneySchema,
  budgetCost: moneySchema,
  forecastRevenue: moneySchema,
  forecastCost: moneySchema,
  isActive: z.boolean().optional(),
})

export const projectDeleteSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const milestoneCreateSchema = z.object({
  organizationId: z.uuid(),
  tenantId: z.uuid(),
  projectId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  status: milestoneStatusSchema.optional(),
  plannedDate: z.string().nullable().optional(),
  actualDate: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const milestoneUpdateSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
  tenantId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  status: milestoneStatusSchema.optional(),
  plannedDate: z.string().nullable().optional(),
  actualDate: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const milestoneDeleteSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const riskCreateSchema = z.object({
  organizationId: z.uuid(),
  tenantId: z.uuid(),
  projectId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullable().optional(),
  riskType: riskTypeSchema.optional(),
  status: riskStatusSchema.optional(),
  ownerEmployeeId: z.uuid().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const riskUpdateSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
  tenantId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  riskType: riskTypeSchema.optional(),
  status: riskStatusSchema.optional(),
  ownerEmployeeId: z.uuid().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const riskDeleteSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>
export type ProjectDeleteInput = z.infer<typeof projectDeleteSchema>
export type MilestoneCreateInput = z.infer<typeof milestoneCreateSchema>
export type MilestoneUpdateInput = z.infer<typeof milestoneUpdateSchema>
export type MilestoneDeleteInput = z.infer<typeof milestoneDeleteSchema>
export type RiskCreateInput = z.infer<typeof riskCreateSchema>
export type RiskUpdateInput = z.infer<typeof riskUpdateSchema>
export type RiskDeleteInput = z.infer<typeof riskDeleteSchema>
