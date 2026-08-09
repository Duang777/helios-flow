import type { EntityManager } from '@mikro-orm/postgresql'
import { defineAiTool } from '@helios/ai-assistant'
import { createAiApiOperationRunner } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolExecutionContext } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolLoadBeforeSingleRecord } from '@helios/ai-assistant/modules/ai_assistant/lib/types'
import { z } from 'zod'
import { KpiTarget } from '../data/entities'
import {
  metricKeySchema,
  periodTypeSchema,
  unitSchema,
  validatePeriodKey,
} from '../data/validators'

export type InsightsWriteToolContext = {
  tenantId?: string | null
  organizationId?: string | null
}

type ManageKpiTargetInput = z.infer<typeof manageKpiTargetInput>

function assertWriteScope(ctx: InsightsWriteToolContext): { tenantId: string; organizationId: string } {
  if (!ctx.tenantId || !ctx.organizationId) {
    throw new Error('[internal] insights AI tools require tenant and organization scope')
  }
  return { tenantId: ctx.tenantId, organizationId: ctx.organizationId }
}

function resolveEm(ctx: AiToolExecutionContext): EntityManager {
  return ctx.container.resolve<EntityManager>('em')
}

function recordVersionFromUpdatedAt(updatedAt: Date | null | undefined): string | null {
  return updatedAt ? updatedAt.toISOString() : null
}

function targetSnapshot(row: KpiTarget): Record<string, unknown> {
  return {
    metricKey: row.metricKey,
    unit: row.unit,
    periodType: row.periodType,
    periodKey: row.periodKey,
    targetValue: row.targetValue,
    currencyCode: row.currencyCode ?? null,
    note: row.note ?? null,
    isActive: !!row.isActive,
  }
}

function targetAfter(input: ManageKpiTargetInput): Record<string, unknown> {
  return {
    metricKey: input.metricKey ?? null,
    unit: input.unit ?? null,
    periodType: input.periodType ?? null,
    periodKey: input.periodKey ?? null,
    targetValue: input.targetValue ?? null,
    currencyCode: input.currencyCode ?? null,
    note: input.note ?? null,
    isActive: input.isActive !== false,
  }
}

async function loadTargetForScope(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  targetId: string,
): Promise<KpiTarget | null> {
  const row = await em.findOne(KpiTarget, {
    id: targetId,
    tenantId,
    organizationId,
    deletedAt: null,
  })
  return row ?? null
}

async function loadTargetPreview(
  input: ManageKpiTargetInput,
  ctx: InsightsWriteToolContext,
): Promise<AiToolLoadBeforeSingleRecord | null> {
  const { tenantId, organizationId } = assertWriteScope(ctx)
  const em = resolveEm(ctx as unknown as AiToolExecutionContext)
  if (input.operation === 'create') {
    return {
      recordId: `create:${input.metricKey}:${input.periodKey}`,
      entityType: 'insights.kpi_target',
      recordVersion: null,
      before: {
        metricKey: null,
        unit: null,
        periodType: null,
        periodKey: null,
        targetValue: null,
        currencyCode: null,
        note: null,
        isActive: null,
      },
      after: targetAfter(input),
    }
  }
  const row = await loadTargetForScope(em, tenantId, organizationId, input.targetId!)
  if (!row) return null
  return {
    recordId: row.id,
    entityType: 'insights.kpi_target',
    recordVersion: recordVersionFromUpdatedAt(row.updatedAt),
    before: targetSnapshot(row),
  }
}

const manageKpiTargetInput = z
  .object({
    operation: z.enum(['create', 'update']),
    targetId: z.string().uuid().optional(),
    metricKey: metricKeySchema.optional(),
    unit: unitSchema.optional(),
    periodType: periodTypeSchema.optional(),
    periodKey: z.string().trim().min(1).max(16).optional(),
    targetValue: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),
    currencyCode: z.string().trim().max(8).nullable().optional(),
    note: z.string().trim().max(4000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.operation === 'create') {
      if (!value.metricKey) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'metricKey is required for create.', path: ['metricKey'] })
      if (!value.unit) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'unit is required for create.', path: ['unit'] })
      if (!value.periodType) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'periodType is required for create.', path: ['periodType'] })
      if (!value.periodKey) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'periodKey is required for create.', path: ['periodKey'] })
      if (!value.targetValue) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'targetValue is required for create.', path: ['targetValue'] })
    }
    if (value.operation === 'update' && !value.targetId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'targetId is required for update.', path: ['targetId'] })
    }
    if (value.periodType && value.periodKey && !validatePeriodKey(value.periodType, value.periodKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'periodKey must match periodType (2026 / 2026-Q3 / 2026-08).',
        path: ['periodKey'],
      })
    }
    if (value.unit === 'amount' && !value.currencyCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'currencyCode is required when unit is amount.',
        path: ['currencyCode'],
      })
    }
    if (value.unit === 'ratio' && value.targetValue) {
      const numeric = Number(value.targetValue)
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Ratio targets must be between 0 and 100.',
          path: ['targetValue'],
        })
      }
    }
  })

const manageKpiTargetTool = defineAiTool({
  name: 'insights.manage_kpi_target',
  displayName: 'Manage KPI target',
  description: 'Create or update a KPI target with confirm-required approval.',
  inputSchema: manageKpiTargetInput,
  requiredFeatures: ['insights.manage'],
  isMutation: true,
  loadBeforeRecord: loadTargetPreview,
  async handler(rawInput: ManageKpiTargetInput, ctx: AiToolExecutionContext) {
    const { tenantId, organizationId } = assertWriteScope(ctx as InsightsWriteToolContext)
    const input = manageKpiTargetInput.parse(rawInput)
    const em = resolveEm(ctx as unknown as AiToolExecutionContext)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)

    if (input.operation === 'create') {
      const response = await runner.run<{ id?: string }>({
        method: 'POST',
        path: '/insights/kpi-targets',
        body: {
          tenantId,
          organizationId,
          metricKey: input.metricKey,
          unit: input.unit,
          periodType: input.periodType,
          periodKey: input.periodKey,
          targetValue: input.targetValue,
          currencyCode: input.currencyCode ?? null,
          note: input.note ?? null,
          isActive: input.isActive,
        },
      })
      if (!response.success) {
        throw new Error(response.error ?? 'Failed to create KPI target')
      }
      const targetId = typeof response.data?.id === 'string' ? response.data.id : null
      if (!targetId) throw new Error('KPI target create succeeded without an id.')
      const after = await loadTargetForScope(em, tenantId, organizationId, targetId)
      return {
        targetId,
        commandName: 'insights.kpi_targets.create',
        before: null,
        after: after ? targetSnapshot(after) : targetAfter(input),
      }
    }

    const existing = await loadTargetForScope(em, tenantId, organizationId, input.targetId!)
    if (!existing) {
      throw new Error(`KPI target "${input.targetId}" is not accessible to the caller.`)
    }
    const body: Record<string, unknown> = { id: existing.id, tenantId, organizationId }
    if (input.metricKey !== undefined) body.metricKey = input.metricKey
    if (input.unit !== undefined) body.unit = input.unit
    if (input.periodType !== undefined) body.periodType = input.periodType
    if (input.periodKey !== undefined) body.periodKey = input.periodKey
    if (input.targetValue !== undefined) body.targetValue = input.targetValue
    if (input.currencyCode !== undefined) body.currencyCode = input.currencyCode
    if (input.note !== undefined) body.note = input.note
    if (input.isActive !== undefined) body.isActive = input.isActive
    const response = await runner.run({ method: 'PUT', path: '/insights/kpi-targets', body })
    if (!response.success) {
      throw new Error(response.error ?? `Failed to update KPI target "${existing.id}"`)
    }
    const after = await loadTargetForScope(em, tenantId, organizationId, existing.id)
    return {
      targetId: existing.id,
      commandName: 'insights.kpi_targets.update',
      before: targetSnapshot(existing),
      after: after ? targetSnapshot(after) : null,
    }
  },
})

export const aiTools = [manageKpiTargetTool]

export default aiTools
