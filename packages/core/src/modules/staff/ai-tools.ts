import { z } from 'zod'
import { defineApiBackedAiTool } from '@helios/ai-assistant/modules/ai_assistant/lib/api-backed-tool'
import type { AiApiOperationRequest } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AwilixContainer } from 'awilix'
import type { ZodType } from 'zod'

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
    'List staff leave requests. Read-only in the operating advisor; do not accept or reject leave from this agent.',
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

export const aiTools: StaffAiToolDefinition[] = [listTeamMembersTool, listLeaveRequestsTool]

export default aiTools
