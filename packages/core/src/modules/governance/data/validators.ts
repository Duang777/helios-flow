import { z } from 'zod'

export const identityMapStatusSchema = z.enum(['active', 'retired'])
export const findingSeveritySchema = z.enum(['info', 'warning', 'critical'])
export const findingStatusSchema = z.enum(['open', 'acknowledged', 'resolved', 'dismissed'])

export const evidenceItemSchema = z.object({
  type: z.string().trim().min(1).max(64),
  id: z.uuid(),
  module: z.string().trim().min(1).max(64),
})

export const identityMapCreateSchema = z.object({
  organizationId: z.uuid(),
  tenantId: z.uuid(),
  sourceEntityId: z.uuid(),
  sourceCustomerCode: z.string().trim().max(128).nullable().optional(),
  canonicalEntityId: z.uuid(),
  canonicalCustomerCode: z.string().trim().max(128).nullable().optional(),
  rationale: z.string().trim().min(1).max(4000),
  status: identityMapStatusSchema.optional(),
  isSimulation: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const identityMapUpdateSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
  tenantId: z.uuid().optional(),
  sourceEntityId: z.uuid().optional(),
  sourceCustomerCode: z.string().trim().max(128).nullable().optional(),
  canonicalEntityId: z.uuid().optional(),
  canonicalCustomerCode: z.string().trim().max(128).nullable().optional(),
  rationale: z.string().trim().min(1).max(4000).optional(),
  status: identityMapStatusSchema.optional(),
  isSimulation: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const identityMapDeleteSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const findingCreateSchema = z.object({
  organizationId: z.uuid(),
  tenantId: z.uuid(),
  ruleId: z.string().trim().min(1).max(128),
  severity: findingSeveritySchema,
  status: findingStatusSchema.optional(),
  title: z.string().trim().min(1).max(512),
  reason: z.string().trim().min(1).max(4000),
  evidenceIds: z.array(evidenceItemSchema).default([]),
  subjectType: z.string().trim().min(1).max(64),
  subjectId: z.uuid(),
  impactSummary: z.string().trim().max(4000).nullable().optional(),
  ownerRole: z.string().trim().max(128).nullable().optional(),
  suggestedDueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  detectedAt: z.string().datetime().optional(),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isSimulation: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const findingUpdateSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
  tenantId: z.uuid().optional(),
  severity: findingSeveritySchema.optional(),
  status: findingStatusSchema.optional(),
  title: z.string().trim().min(1).max(512).optional(),
  reason: z.string().trim().min(1).max(4000).optional(),
  evidenceIds: z.array(evidenceItemSchema).optional(),
  impactSummary: z.string().trim().max(4000).nullable().optional(),
  ownerRole: z.string().trim().max(128).nullable().optional(),
  suggestedDueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  isSimulation: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const findingDeleteSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const rulesRunSchema = z.object({
  organizationId: z.uuid(),
  tenantId: z.uuid(),
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export type IdentityMapCreateInput = z.infer<typeof identityMapCreateSchema>
export type IdentityMapUpdateInput = z.infer<typeof identityMapUpdateSchema>
export type IdentityMapDeleteInput = z.infer<typeof identityMapDeleteSchema>
export type FindingCreateInput = z.infer<typeof findingCreateSchema>
export type FindingUpdateInput = z.infer<typeof findingUpdateSchema>
export type FindingDeleteInput = z.infer<typeof findingDeleteSchema>
export type RulesRunInput = z.infer<typeof rulesRunSchema>
