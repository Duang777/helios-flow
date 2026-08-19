import { z } from 'zod'
import { defineApiBackedAiTool } from '@helios/ai-assistant/modules/ai_assistant/lib/api-backed-tool'
import type { AiApiOperationRequest } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AwilixContainer } from 'awilix'
import type { ZodType } from 'zod'

export interface MessagesToolContext {
  tenantId: string | null
  organizationId: string | null
  userId: string | null
  container: AwilixContainer
  userFeatures: string[]
  isSuperAdmin: boolean
}

export interface MessagesAiToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string
  displayName?: string
  description: string
  inputSchema: ZodType<TInput>
  requiredFeatures?: string[]
  isMutation?: boolean
  toOperation?: unknown
  mapResponse?: unknown
  handler?: (input: TInput, ctx: MessagesToolContext) => Promise<TOutput> | TOutput
}

export function assertTenantScope(ctx: MessagesToolContext): {
  tenantId: string
  organizationId: string | null
} {
  if (!ctx.tenantId) {
    throw new Error('[internal] Tenant context is required for messages.* tools')
  }
  return { tenantId: ctx.tenantId, organizationId: ctx.organizationId ?? null }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function mapMessage(row: Record<string, unknown>): Record<string, unknown> {
  const id = typeof row.id === 'string' ? row.id : null
  return {
    id,
    subject: row.subject ?? null,
    status: row.status ?? null,
    isDraft: row.isDraft ?? row.is_draft ?? null,
    senderUserId: row.senderUserId ?? row.sender_user_id ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
    href: id ? `/backend/messages/${id}` : '/backend/messages',
  }
}

const listInput = z.object({
  q: z.string().trim().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
})

type ListInput = z.infer<typeof listInput>

const listMessagesTool = defineApiBackedAiTool({
  name: 'messages.list_messages',
  displayName: 'List messages',
  description:
    'List internal messages for the caller tenant. Read-only. Returns evidence ids and backend hrefs; empty lists still include the inbox collection href.',
  inputSchema: listInput,
  requiredFeatures: ['messages.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as MessagesToolContext)
    const limit = input.limit ?? 25
    const offset = input.offset ?? 0
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/messages',
      query: {
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        search: input.q,
      },
    }
    return operation
  },
  mapResponse: (response, input) => {
    const payload = asRecord(response.data) ?? {}
    const items = Array.isArray(payload.items) ? payload.items : []
    const mapped = items
      .map((row) => asRecord(row))
      .filter((row): row is Record<string, unknown> => row !== null)
      .map(mapMessage)
    return {
      items: mapped,
      total: typeof payload.total === 'number' ? payload.total : mapped.length,
      limit: input.limit ?? 25,
      offset: input.offset ?? 0,
      href: '/backend/messages',
    }
  },
}) as unknown as MessagesAiToolDefinition

const getInput = z.object({
  messageId: z.string().uuid(),
})

const getMessageTool = defineApiBackedAiTool({
  name: 'messages.get_message',
  displayName: 'Get message',
  description: 'Fetch one internal message by id. Read-only. Never claims the message was sent or archived.',
  inputSchema: getInput,
  requiredFeatures: ['messages.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as MessagesToolContext)
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: `/messages/${input.messageId}`,
      query: { skipMarkRead: '1' },
    }
    return operation
  },
  mapResponse: (response) => {
    const row = asRecord(response.data) ?? {}
    return {
      ...mapMessage(row),
      bodyPreview: typeof row.body === 'string' ? row.body.slice(0, 500) : null,
    }
  },
}) as unknown as MessagesAiToolDefinition

export const aiTools: MessagesAiToolDefinition[] = [listMessagesTool, getMessageTool]

export default aiTools
