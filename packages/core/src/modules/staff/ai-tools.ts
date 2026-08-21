import { z } from 'zod'
import { defineAiTool } from '@helios/ai-assistant'
import { defineApiBackedAiTool } from '@helios/ai-assistant/modules/ai_assistant/lib/api-backed-tool'
import {
  createAiApiOperationRunner,
  type AiApiOperationRequest,
  type AiToolExecutionContext,
} from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolLoadBeforeSingleRecord } from '@helios/ai-assistant/modules/ai_assistant/lib/types'
import type { AwilixContainer } from 'awilix'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { ZodType } from 'zod'
import { StaffLeaveRequest } from './data/entities'

export interface StaffToolContext {
  tenantId: string | null
  organizationId: string | null
  userId: string | null
  container: AwilixContainer
  userFeatures: string[]
  isSuperAdmin: boolean
}

export interface StaffAiToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string
  displayName?: string
  description: string
  inputSchema: ZodType<TInput>
  requiredFeatures?: string[]
  isMutation?: boolean
  toOperation?: unknown
  mapResponse?: unknown
  handler?: (input: TInput, ctx: StaffToolContext) => Promise<TOutput> | TOutput
  loadBeforeRecord?: unknown
}

export function assertTenantScope(ctx: StaffToolContext): {
  tenantId: string
  organizationId: string | null
} {
  if (!ctx.tenantId) {
    throw new Error('[internal] Tenant context is required for staff.* tools')
  }
  return { tenantId: ctx.tenantId, organizationId: ctx.organizationId ?? null }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function pick(row: Record<string, unknown>, camel: string, snake: string): unknown {
  return row[camel] ?? row[snake] ?? null
}

const pageInput = z.object({
  q: z.string().trim().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
})

type PageInput = z.infer<typeof pageInput>

function toPageQuery(input: PageInput, extra?: Record<string, string | undefined>) {
  const limit = input.limit ?? 25
  const offset = input.offset ?? 0
  return {
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    search: input.q,
    ...extra,
  }
}

function resolveEm(ctx: StaffToolContext): EntityManager {
  return ctx.container.resolve<EntityManager>('em')
}

function leaveSnapshot(row: StaffLeaveRequest): Record<string, unknown> {
  const member = row.member
  const memberId =
    member && typeof member === 'object' && 'id' in member && typeof member.id === 'string'
      ? member.id
      : null
  return {
    status: row.status,
    startDate: row.startDate ?? null,
    endDate: row.endDate ?? null,
    memberId,
    decisionComment: row.decisionComment ?? null,
  }
}

async function loadLeaveForScope(
  em: EntityManager,
  ctx: StaffToolContext,
  tenantId: string,
  leaveRequestId: string,
): Promise<StaffLeaveRequest | null> {
  const row = await em.findOne(
    StaffLeaveRequest,
    {
      id: leaveRequestId,
      tenantId,
      organizationId: ctx.organizationId ?? undefined,
      deletedAt: null,
    },
    { populate: ['member'] },
  )
  if (!row) return null
  if (ctx.organizationId && row.organizationId !== ctx.organizationId) return null
  return row
}

async function loadLeavePreview(
  input: { id: string },
  ctx: StaffToolContext,
): Promise<AiToolLoadBeforeSingleRecord | null> {
  const { tenantId } = assertTenantScope(ctx)
  const row = await loadLeaveForScope(resolveEm(ctx), ctx, tenantId, input.id)
  if (!row) return null
  return {
    recordId: row.id,
    entityType: 'staff.leave_request',
    recordVersion: row.updatedAt ? row.updatedAt.toISOString() : null,
    before: leaveSnapshot(row),
  }
}

const listTeamMembersTool = defineApiBackedAiTool({
  name: 'staff.list_team_members',
  displayName: 'List team members',
  description:
    'List staff team members for the caller organization. Read-only. Use for ownership context on projects/deals; never creates or edits employees.',
  inputSchema: pageInput.extend({
    teamId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
  }),
  requiredFeatures: ['staff.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as StaffToolContext)
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/staff/team-members',
      query: toPageQuery(input, {
        teamId: input.teamId,
        isActive: input.isActive === undefined ? undefined : input.isActive ? 'true' : 'false',
      }),
    }
    return operation
  },
  mapResponse: (response, input) => {
    const payload = asRecord(response.data) ?? {}
    const items = Array.isArray(payload.items) ? payload.items : []
    return {
      items: items
        .map((row) => asRecord(row))
        .filter((row): row is Record<string, unknown> => row !== null)
        .map((row) => {
          const id = typeof row.id === 'string' ? row.id : null
          return {
            id,
            displayName: pick(row, 'displayName', 'display_name'),
            teamId: pick(row, 'teamId', 'team_id'),
            isActive: pick(row, 'isActive', 'is_active'),
            tags: row.tags ?? null,
            href: id ? `/backend/staff/team-members/${id}` : '/backend/staff/team-members',
          }
        }),
      total: typeof payload.total === 'number' ? payload.total : items.length,
      limit: input.limit ?? 25,
      offset: input.offset ?? 0,
      href: '/backend/staff/team-members',
    }
  },
}) as unknown as StaffAiToolDefinition

const listLeaveRequestsTool = defineApiBackedAiTool({
  name: 'staff.list_leave_requests',
  displayName: 'List leave requests',
  description:
    'List staff leave requests. Approve/reject with staff.accept_leave_request or staff.reject_leave_request (confirm-required).',
  inputSchema: pageInput.extend({
    status: z.string().optional(),
    memberId: z.string().uuid().optional(),
  }),
  requiredFeatures: ['staff.leave_requests.manage'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as StaffToolContext)
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/staff/leave-requests',
      query: toPageQuery(input, {
        status: input.status,
        memberId: input.memberId,
      }),
    }
    return operation
  },
  mapResponse: (response, input) => {
    const payload = asRecord(response.data) ?? {}
    const items = Array.isArray(payload.items) ? payload.items : []
    return {
      items: items
        .map((row) => asRecord(row))
        .filter((row): row is Record<string, unknown> => row !== null)
        .map((row) => {
          const id = typeof row.id === 'string' ? row.id : null
          return {
            id,
            memberId: pick(row, 'memberId', 'member_id'),
            startDate: pick(row, 'startDate', 'start_date'),
            endDate: pick(row, 'endDate', 'end_date'),
            status: row.status ?? null,
            href: id ? `/backend/staff/leave-requests/${id}` : '/backend/staff/leave-requests',
          }
        }),
      total: typeof payload.total === 'number' ? payload.total : items.length,
      limit: input.limit ?? 25,
      offset: input.offset ?? 0,
      href: '/backend/staff/leave-requests',
    }
  },
}) as unknown as StaffAiToolDefinition

const decisionInput = z.object({
  id: z.string().uuid(),
  decisionComment: z.string().max(2000).optional().nullable(),
})

type DecisionInput = z.infer<typeof decisionInput>

const acceptLeaveRequestTool = defineAiTool({
  name: 'staff.accept_leave_request',
  displayName: 'Accept leave request',
  description:
    'Approve a pending leave request. Confirm-required. Call staff.list_leave_requests first. Do not claim approval until the card is confirmed.',
  inputSchema: decisionInput,
  requiredFeatures: ['staff.leave_requests.manage'],
  isMutation: true,
  loadBeforeRecord: loadLeavePreview,
  async handler(rawInput: DecisionInput, ctx: StaffToolContext) {
    const { tenantId } = assertTenantScope(ctx)
    const input = decisionInput.parse(rawInput)
    const em = resolveEm(ctx)
    const existing = await loadLeaveForScope(em, ctx, tenantId, input.id)
    if (!existing) throw new Error(`Leave request "${input.id}" is not accessible to the caller.`)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)
    const response = await runner.run<{ ok?: boolean; id?: string | null }>({
      method: 'POST',
      path: '/staff/leave-requests/accept',
      body: {
        id: input.id,
        decisionComment: input.decisionComment ?? null,
      },
    })
    if (!response.success) {
      throw new Error(response.error ?? `Failed to approve leave request "${input.id}"`)
    }
    return {
      id: response.data?.id ?? input.id,
      commandName: 'staff.leave-requests.accept',
      before: leaveSnapshot(existing),
      href: `/backend/staff/leave-requests/${input.id}`,
    }
  },
}) as StaffAiToolDefinition

const rejectLeaveRequestTool = defineAiTool({
  name: 'staff.reject_leave_request',
  displayName: 'Reject leave request',
  description:
    'Reject a pending leave request. Confirm-required. Call staff.list_leave_requests first. Do not claim rejection until the card is confirmed.',
  inputSchema: decisionInput,
  requiredFeatures: ['staff.leave_requests.manage'],
  isMutation: true,
  loadBeforeRecord: loadLeavePreview,
  async handler(rawInput: DecisionInput, ctx: StaffToolContext) {
    const { tenantId } = assertTenantScope(ctx)
    const input = decisionInput.parse(rawInput)
    const em = resolveEm(ctx)
    const existing = await loadLeaveForScope(em, ctx, tenantId, input.id)
    if (!existing) throw new Error(`Leave request "${input.id}" is not accessible to the caller.`)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)
    const response = await runner.run<{ ok?: boolean; id?: string | null }>({
      method: 'POST',
      path: '/staff/leave-requests/reject',
      body: {
        id: input.id,
        decisionComment: input.decisionComment ?? null,
      },
    })
    if (!response.success) {
      throw new Error(response.error ?? `Failed to reject leave request "${input.id}"`)
    }
    return {
      id: response.data?.id ?? input.id,
      commandName: 'staff.leave-requests.reject',
      before: leaveSnapshot(existing),
      href: `/backend/staff/leave-requests/${input.id}`,
    }
  },
}) as StaffAiToolDefinition

export const aiTools: StaffAiToolDefinition[] = [
  listTeamMembersTool,
  listLeaveRequestsTool,
  acceptLeaveRequestTool,
  rejectLeaveRequestTool,
]

export default aiTools
