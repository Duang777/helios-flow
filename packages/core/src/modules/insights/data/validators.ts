import { z } from 'zod'

export const metricKeySchema = z.enum(['revenue', 'gross_profit', 'gross_margin', 'collection'])
export const unitSchema = z.enum(['amount', 'ratio'])
export const periodTypeSchema = z.enum(['year', 'quarter', 'month'])

const targetValueSchema = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, 'Target value must be a non-negative decimal')

const yearKeySchema = z.string().regex(/^\d{4}$/)
const quarterKeySchema = z.string().regex(/^\d{4}-Q[1-4]$/)
const monthKeySchema = z.string().regex(/^\d{4}-\d{2}$/)

export function validatePeriodKey(periodType: z.infer<typeof periodTypeSchema>, periodKey: string): boolean {
  if (periodType === 'year') return yearKeySchema.safeParse(periodKey).success
  if (periodType === 'quarter') return quarterKeySchema.safeParse(periodKey).success
  return monthKeySchema.safeParse(periodKey).success
}

function periodKeyRefinement(
  data: { periodType: z.infer<typeof periodTypeSchema>; periodKey: string },
  ctx: z.RefinementCtx,
): void {
  if (!validatePeriodKey(data.periodType, data.periodKey)) {
    ctx.addIssue({
      code: 'custom',
      message: 'periodKey must match periodType (2026 / 2026-Q3 / 2026-08)',
      path: ['periodKey'],
    })
  }
}

function unitRefinement(
  data: { unit: z.infer<typeof unitSchema>; currencyCode?: string | null; targetValue: string },
  ctx: z.RefinementCtx,
): void {
  if (data.unit === 'amount' && !data.currencyCode) {
    ctx.addIssue({
      code: 'custom',
      message: 'currencyCode is required when unit is amount',
      path: ['currencyCode'],
    })
  }
  if (data.unit === 'ratio') {
    const numeric = Number(data.targetValue)
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
      ctx.addIssue({
        code: 'custom',
        message: 'Ratio targets must be between 0 and 100',
        path: ['targetValue'],
      })
    }
  }
}

export const kpiTargetCreateSchema = z
  .object({
    organizationId: z.uuid(),
    tenantId: z.uuid(),
    metricKey: metricKeySchema,
    unit: unitSchema,
    periodType: periodTypeSchema,
    periodKey: z.string().trim().min(1).max(16),
    targetValue: targetValueSchema,
    currencyCode: z.string().trim().max(8).nullable().optional(),
    note: z.string().trim().max(4000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine(periodKeyRefinement)
  .superRefine(unitRefinement)

export const kpiTargetUpdateSchema = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid().optional(),
    tenantId: z.uuid().optional(),
    metricKey: metricKeySchema.optional(),
    unit: unitSchema.optional(),
    periodType: periodTypeSchema.optional(),
    periodKey: z.string().trim().min(1).max(16).optional(),
    targetValue: targetValueSchema.optional(),
    currencyCode: z.string().trim().max(8).nullable().optional(),
    note: z.string().trim().max(4000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.periodType && data.periodKey) {
      periodKeyRefinement(
        { periodType: data.periodType, periodKey: data.periodKey },
        ctx,
      )
    }
    if (data.unit && data.targetValue) {
      unitRefinement(
        {
          unit: data.unit,
          currencyCode: data.currencyCode,
          targetValue: data.targetValue,
        },
        ctx,
      )
    }
  })

export const kpiTargetDeleteSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const completionQuerySchema = z.object({
  organizationId: z.uuid(),
  periodType: periodTypeSchema,
  periodKey: z.string().trim().min(1).max(16),
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  includeDescendants: z.enum(['true', 'false']).optional(),
})

export type KpiTargetCreateInput = z.infer<typeof kpiTargetCreateSchema>
export type KpiTargetUpdateInput = z.infer<typeof kpiTargetUpdateSchema>
export type KpiTargetDeleteInput = z.infer<typeof kpiTargetDeleteSchema>
export type CompletionQueryInput = z.infer<typeof completionQuerySchema>
