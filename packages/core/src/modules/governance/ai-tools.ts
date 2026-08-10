import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { defineAiTool } from '@helios/ai-assistant'
import { defineApiBackedAiTool } from '@helios/ai-assistant/modules/ai_assistant/lib/api-backed-tool'
import {
  createAiApiOperationRunner,
  type AiApiOperationRequest,
  type AiToolExecutionContext,
} from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type {
  AiToolDefinition,
  McpToolContext,
} from '@helios/ai-assistant/modules/ai_assistant/lib/types'
import { GovernanceFinding } from './data/entities'
import { RULE_EXPLANATIONS, RULE_ID_LIST } from './lib/rules/metadata'

export type GovernanceToolContext = Pick<McpToolContext, 'tenantId' | 'organizationId' | 'container'>

export type GovernanceAiToolDefinition = ReturnType<typeof defineApiBackedAiTool>

function assertTenantScope(ctx: GovernanceToolContext): void {
  if (!ctx.tenantId || !ctx.organizationId) {
    throw new Error('[internal] governance AI tools require tenant and organization scope')
  }
}

function scopedFindingFilter(
  findingId: string,
  ctx: GovernanceToolContext,
): FilterQuery<GovernanceFinding> {
  assertTenantScope(ctx)
  return {
    id: findingId,
    tenantId: String(ctx.tenantId),
    organizationId: String(ctx.organizationId),
    deletedAt: null,
  } as FilterQuery<GovernanceFinding>
}

function recordVersionFromUpdatedAt(updatedAt: Date | null | undefined): string | null {
  return updatedAt ? updatedAt.toISOString() : null
}

async function loadFindingPreview(
  input: {
    findingId: string
    status?: string
    ownerRole?: string | null
    suggestedDueOn?: string | null
    impactSummary?: string | null
  },
  ctx: GovernanceToolContext,
) {
  const em = ctx.container.resolve('em') as EntityManager
  const finding = await em.findOne(GovernanceFinding, scopedFindingFilter(input.findingId, ctx))
  if (!finding) return null
  const after: Record<string, unknown> = {}
  if (input.status !== undefined) after.status = input.status
  if (input.ownerRole !== undefined) after.ownerRole = input.ownerRole
  if (input.suggestedDueOn !== undefined) after.suggestedDueOn = input.suggestedDueOn
  if (input.impactSummary !== undefined) after.impactSummary = input.impactSummary
  return {
    recordId: finding.id,
    entityType: 'governance.finding',
    recordVersion: recordVersionFromUpdatedAt(finding.updatedAt),
    before: {
      status: finding.status,
      ownerRole: finding.ownerRole ?? null,
      suggestedDueOn: finding.suggestedDueOn ?? null,
      impactSummary: finding.impactSummary ?? null,
    },
    after,
  }
}

function findingUpdateBody(
  input: {
    findingId: string
    status?: string
    ownerRole?: string | null
    suggestedDueOn?: string | null
    impactSummary?: string | null
  },
  ctx: GovernanceToolContext,
): Record<string, unknown> {
  assertTenantScope(ctx)
  const body: Record<string, unknown> = {
    id: input.findingId,
    organizationId: ctx.organizationId,
    tenantId: ctx.tenantId,
  }
  if (input.status !== undefined) body.status = input.status
  if (input.ownerRole !== undefined) body.ownerRole = input.ownerRole
  if (input.suggestedDueOn !== undefined) body.suggestedDueOn = input.suggestedDueOn
  if (input.impactSummary !== undefined) body.impactSummary = input.impactSummary
  return body
}

const listIdentityMapsInput = z
  .object({
    status: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .passthrough()

const listIdentityMapsTool = defineApiBackedAiTool({
  name: 'governance.list_identity_maps',
  displayName: 'List identity maps',
  description: 'List customer identity dedupe mappings (source rows kept).',
  inputSchema: listIdentityMapsInput,
  requiredFeatures: ['governance.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as GovernanceToolContext)
    const query: Record<string, string | number> = {
      page: 1,
      pageSize: input.limit ?? 50,
    }
    if (input.status) query.status = input.status
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/governance/identity-maps',
      query,
    }
    return operation
  },
  mapResponse: (response) => {
    const data = (response.data ?? {}) as { items?: Array<Record<string, unknown>>; total?: number }
    return {
      items: Array.isArray(data.items) ? data.items : [],
      total: typeof data.total === 'number' ? data.total : 0,
    }
  },
}) as unknown as GovernanceAiToolDefinition

const listFindingsInput = z
  .object({
    status: z.string().optional(),
    ruleId: z.string().optional(),
    severity: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .passthrough()

const listFindingsTool = defineApiBackedAiTool({
  name: 'governance.list_findings',
  displayName: 'List governance findings',
  description: 'List structured governance findings with evidence IDs for disposition advice.',
  inputSchema: listFindingsInput,
  requiredFeatures: ['governance.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as GovernanceToolContext)
    const query: Record<string, string | number> = {
      page: 1,
      pageSize: input.limit ?? 50,
    }
    if (input.status) query.status = input.status
    if (input.ruleId) query.ruleId = input.ruleId
    if (input.severity) query.severity = input.severity
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/governance/findings',
      query,
    }
    return operation
  },
  mapResponse: (response) => {
    const data = (response.data ?? {}) as { items?: Array<Record<string, unknown>>; total?: number }
    return {
      items: Array.isArray(data.items) ? data.items : [],
      total: typeof data.total === 'number' ? data.total : 0,
    }
  },
}) as unknown as GovernanceAiToolDefinition

const acknowledgeFindingInput = z.object({
  findingId: z.string().uuid(),
})

const acknowledgeFindingTool = defineApiBackedAiTool({
  name: 'governance.acknowledge_finding',
  displayName: 'Acknowledge finding',
  description: 'Mark a governance finding as acknowledged (requires operator confirmation).',
  inputSchema: acknowledgeFindingInput,
  requiredFeatures: ['governance.manage'],
  isMutation: true,
  loadBeforeRecord: async (input, ctx) =>
    loadFindingPreview(
      { findingId: input.findingId, status: 'acknowledged' },
      ctx as GovernanceToolContext,
    ),
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as GovernanceToolContext)
    const operation: AiApiOperationRequest = {
      method: 'PUT',
      path: '/governance/findings',
      body: {
        id: input.findingId,
        organizationId: (ctx as GovernanceToolContext).organizationId,
        tenantId: (ctx as GovernanceToolContext).tenantId,
        status: 'acknowledged',
      },
    }
    return operation
  },
  mapResponse: () => ({ ok: true }),
}) as unknown as GovernanceAiToolDefinition

const updateFindingDispositionInput = z
  .object({
    findingId: z.string().uuid(),
    status: z.enum(['open', 'acknowledged', 'resolved', 'dismissed']).optional(),
    ownerRole: z.string().trim().min(1).max(128).nullable().optional(),
    suggestedDueOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    impactSummary: z.string().trim().min(1).max(4000).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const hasPatch =
      value.status !== undefined ||
      value.ownerRole !== undefined ||
      value.suggestedDueOn !== undefined ||
      value.impactSummary !== undefined
    if (!hasPatch) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one disposition field is required.',
        path: ['status'],
      })
    }
  })

type UpdateFindingDispositionInput = z.infer<typeof updateFindingDispositionInput>

const updateFindingDispositionTool = defineApiBackedAiTool({
  name: 'governance.update_finding_disposition',
  displayName: 'Update finding disposition',
  description:
    'Assign owner role, suggested completion date, status, or impact summary for one governance finding. Requires operator confirmation.',
  inputSchema: updateFindingDispositionInput,
  requiredFeatures: ['governance.manage'],
  isMutation: true,
  loadBeforeRecord: async (input: UpdateFindingDispositionInput, ctx: McpToolContext) =>
    loadFindingPreview(input, ctx as GovernanceToolContext),
  toOperation: (input, ctx) => ({
    method: 'PUT',
    path: '/governance/findings',
    body: findingUpdateBody(input, ctx as GovernanceToolContext),
  }),
  mapResponse: (_response, input) => ({
    ok: true,
    findingId: input.findingId,
    href: `/backend/governance/findings/${input.findingId}`,
  }),
}) as unknown as GovernanceAiToolDefinition

const acknowledgeFindingsInput = z.object({
  findingIds: z.array(z.string().uuid()).min(1).max(20),
})

type AcknowledgeFindingsInput = z.infer<typeof acknowledgeFindingsInput>

let acknowledgeFindingsTool: AiToolDefinition<AcknowledgeFindingsInput, Record<string, unknown>>

acknowledgeFindingsTool = defineAiTool({
  name: 'governance.acknowledge_findings',
  displayName: 'Acknowledge findings',
  description:
    'Acknowledge up to 20 governance findings in one confirmed action. Reports per-record success or failure.',
  inputSchema: acknowledgeFindingsInput,
  requiredFeatures: ['governance.manage'],
  isMutation: true,
  loadBeforeRecord: async (input: AcknowledgeFindingsInput, _ctx: McpToolContext) => ({
    recordId: input.findingIds[0] ?? 'governance-findings-batch',
    entityType: 'governance.finding.batch',
    recordVersion: null,
    before: {
      findingIds: input.findingIds,
      status: 'mixed',
    },
    after: {
      findingIds: input.findingIds,
      status: 'acknowledged',
      count: input.findingIds.length,
    },
  }),
  async handler(input: AcknowledgeFindingsInput, ctx: McpToolContext) {
    assertTenantScope(ctx as GovernanceToolContext)
    const toolCtx: AiToolExecutionContext = {
      ...ctx,
      tool: acknowledgeFindingsTool as AiToolDefinition,
    }
    const runner = createAiApiOperationRunner(toolCtx)
    const records: Array<Record<string, unknown>> = []
    for (const findingId of input.findingIds) {
      const response = await runner.run({
        method: 'PUT',
        path: '/governance/findings',
        body: findingUpdateBody(
          { findingId, status: 'acknowledged' },
          ctx as GovernanceToolContext,
        ),
      })
      if (response.success) {
        records.push({
          recordId: findingId,
          status: 'updated',
          href: `/backend/governance/findings/${findingId}`,
        })
      } else {
        records.push({
          recordId: findingId,
          status: 'failed',
          error: {
            code: 'api_error',
            message: response.error ?? 'Failed to acknowledge finding.',
          },
        })
      }
    }
    const failedRecordIds = records
      .filter((record) => record.status === 'failed')
      .map((record) => record.recordId)
    return {
      commandName: 'governance.findings.batch_acknowledge',
      records,
      failedRecordIds,
    }
  },
}) as AiToolDefinition<AcknowledgeFindingsInput, Record<string, unknown>>

const explainRuleInput = z
  .object({
    ruleId: z
      .enum(RULE_ID_LIST as [string, ...string[]])
      .optional()
      .describe('Governance rule id (e.g. gov.project_milestone_delayed). Omit to list all rule explanations.'),
  })
  .passthrough()

type ExplainRuleInput = z.infer<typeof explainRuleInput>

const explainRuleTool = defineAiTool({
  name: 'governance.explain_rule',
  displayName: 'Explain governance rule',
  description:
    'Explain how a governance rule is triggered, its severity, owner role, impact, and evidence types. ' +
    'Use this before interpreting findings or suggesting dispositions so the answer cites the right threshold.',
  inputSchema: explainRuleInput,
  requiredFeatures: ['governance.view'],
  tags: ['read', 'explain', 'operating-loop', 'governance'],
  isMutation: false,
  async handler(rawInput: unknown, ctx: McpToolContext) {
    assertTenantScope(ctx as GovernanceToolContext)
    const input = explainRuleInput.parse(rawInput)
    if (input.ruleId) {
      const rule = RULE_EXPLANATIONS[input.ruleId]
      if (!rule) {
        return { found: false, ruleId: input.ruleId }
      }
      return { found: true, rule }
    }
    return {
      found: true,
      rules: RULE_ID_LIST.map((id) => {
        const rule = RULE_EXPLANATIONS[id]
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          severity: rule.severity,
          ownerRole: rule.ownerRole,
          trigger: rule.trigger,
          href: rule.href,
        }
      }),
    }
  },
}) as unknown as GovernanceAiToolDefinition

const suggestDispositionInput = z.object({
  findingId: z.string().uuid().describe('Governance finding id to build a disposition suggestion for.'),
})

type SuggestDispositionInput = z.infer<typeof suggestDispositionInput>

const governanceDispositionSuggestion = z.object({
  suggestedStatus: z.enum(['open', 'acknowledged', 'resolved', 'dismissed']).describe('Recommended disposition status.'),
  ownerRole: z.string().nullable().describe('Recommended owner role to drive the remediation.'),
  suggestedDueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe('Recommended due date (YYYY-MM-DD) or null.'),
  impactSummary: z.string().nullable().describe('Recommended impact summary text.'),
  rationale: z.string().describe('Why this disposition is recommended for this finding.'),
})

const SUGGEST_DISPOSITION_SCHEMA = 'GovernanceDispositionSuggestion'

const suggestDispositionTool = defineAiTool({
  name: 'governance.suggest_disposition',
  displayName: 'Suggest finding disposition',
  description:
    'Build a structured disposition suggestion for one governance finding (status, owner, due date, rationale). ' +
    'Read-only: the surrounding agent fills the proposal, then persists it through governance.update_finding_disposition.',
  inputSchema: suggestDispositionInput,
  requiredFeatures: ['governance.view'],
  tags: ['read', 'suggest', 'operating-loop', 'governance'],
  isMutation: false,
  async handler(rawInput: unknown, ctx: McpToolContext) {
    const input = suggestDispositionInput.parse(rawInput)
    assertTenantScope(ctx as GovernanceToolContext)
    const em = (ctx as GovernanceToolContext).container.resolve('em') as EntityManager
    const finding = await em.findOne(GovernanceFinding, scopedFindingFilter(input.findingId, ctx as GovernanceToolContext))
    if (!finding) {
      return { found: false, findingId: input.findingId }
    }
    const rule = RULE_EXPLANATIONS[finding.ruleId]
    return {
      found: true,
      findingId: finding.id,
      context: {
        ruleId: finding.ruleId,
        severity: finding.severity,
        ownerRole: finding.ownerRole ?? (rule ? rule.ownerRole : null),
        impactSummary: finding.impactSummary ?? (rule ? rule.impactSummary : null),
        evidenceIds: finding.evidenceIds ?? [],
        ruleExplanation: rule
          ? { trigger: rule.trigger, ownerRole: rule.ownerRole, impactSummary: rule.impactSummary }
          : null,
      },
      proposal: {
        suggestedStatus: 'resolved' as const,
        ownerRole: (rule ? rule.ownerRole : null) as string | null,
        suggestedDueOn: null,
        impactSummary: null,
        rationale: '',
      },
      outputSchemaDescriptor: {
        schemaName: SUGGEST_DISPOSITION_SCHEMA,
        jsonSchema: z.toJSONSchema(governanceDispositionSuggestion) as Record<string, unknown>,
      },
      href: `/backend/governance/findings/${finding.id}`,
    }
  },
}) as unknown as GovernanceAiToolDefinition

export const aiTools: GovernanceAiToolDefinition[] = [
  listIdentityMapsTool,
  listFindingsTool,
  explainRuleTool,
  suggestDispositionTool,
  acknowledgeFindingTool,
  updateFindingDispositionTool,
  acknowledgeFindingsTool as unknown as GovernanceAiToolDefinition,
]

export default aiTools
