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
  loadBeforeRecord?: unknown
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

const sendMessageInput = z.object({
  recipientUserIds: z.array(z.string().uuid()).min(1).max(100),
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(50000),
  bodyFormat: z.enum(['text', 'markdown']).optional().default('text'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
})

type SendMessageInput = z.infer<typeof sendMessageInput>

const replyMessageInput = z.object({
  messageId: z.string().uuid(),
  body: z.string().trim().min(1).max(50000),
  bodyFormat: z.enum(['text', 'markdown']).optional().default('text'),
  replyAll: z.boolean().optional().default(false),
})

type ReplyMessageInput = z.infer<typeof replyMessageInput>

async function previewSendMessage(
  input: SendMessageInput,
  _ctx: MessagesToolContext,
): Promise<AiToolLoadBeforeSingleRecord> {
  return {
    recordId: `messages.send:${input.recipientUserIds.join(',')}:${input.subject.slice(0, 40)}`,
    entityType: 'messages.message',
    recordVersion: null,
    before: {
      status: null,
      subject: null,
      recipientCount: 0,
      sendViaEmail: false,
    },
    after: {
      status: 'pending_send',
      subject: input.subject,
      bodyPreview: input.body.slice(0, 200),
      recipientCount: input.recipientUserIds.length,
      recipientUserIds: input.recipientUserIds,
      sendViaEmail: false,
      priority: input.priority ?? 'normal',
    },
  }
}

async function previewReplyMessage(
  input: ReplyMessageInput,
  _ctx: MessagesToolContext,
): Promise<AiToolLoadBeforeSingleRecord> {
  return {
    recordId: input.messageId,
    entityType: 'messages.message',
    recordVersion: null,
    before: {
      messageId: input.messageId,
      replyBody: null,
      sendViaEmail: false,
    },
    after: {
      messageId: input.messageId,
      replyBodyPreview: input.body.slice(0, 200),
      replyAll: input.replyAll ?? false,
      sendViaEmail: false,
    },
  }
}

const sendMessageTool = defineAiTool({
  name: 'messages.send_message',
  displayName: 'Send message',
  description:
    'Compose and send an in-app internal message to one or more users. Confirm-required. Never sends email (sendViaEmail is forced false). Do not claim the message was sent until the confirmation card is confirmed.',
  inputSchema: sendMessageInput,
  requiredFeatures: ['messages.compose'],
  isMutation: true,
  loadBeforeRecord: previewSendMessage,
  async handler(rawInput: SendMessageInput, ctx: MessagesToolContext) {
    assertTenantScope(ctx)
    const input = sendMessageInput.parse(rawInput)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)
    const response = await runner.run<{ id?: string | null }>({
      method: 'POST',
      path: '/messages',
      body: {
        type: 'default',
        visibility: 'internal',
        recipients: input.recipientUserIds.map((userId) => ({ userId, type: 'to' as const })),
        subject: input.subject,
        body: input.body,
        bodyFormat: input.bodyFormat ?? 'text',
        priority: input.priority ?? 'normal',
        sendViaEmail: false,
        isDraft: false,
      },
    })
    if (!response.success) {
      throw new Error(response.error ?? 'Failed to send message')
    }
    const id = typeof response.data?.id === 'string' ? response.data.id : null
    return {
      id,
      commandName: 'messages.messages.compose',
      sendViaEmail: false,
      href: id ? `/backend/messages/${id}` : '/backend/messages',
    }
  },
}) as MessagesAiToolDefinition

const replyMessageTool = defineAiTool({
  name: 'messages.reply_to_message',
  displayName: 'Reply to message',
  description:
    'Reply to an existing internal message. Confirm-required. Never sends email. Call messages.get_message first. Do not claim the reply was sent until the confirmation card is confirmed.',
  inputSchema: replyMessageInput,
  requiredFeatures: ['messages.compose'],
  isMutation: true,
  loadBeforeRecord: previewReplyMessage,
  async handler(rawInput: ReplyMessageInput, ctx: MessagesToolContext) {
    assertTenantScope(ctx)
    const input = replyMessageInput.parse(rawInput)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)
    const response = await runner.run<{ id?: string | null }>({
      method: 'POST',
      path: `/messages/${input.messageId}/reply`,
      body: {
        body: input.body,
        bodyFormat: input.bodyFormat ?? 'text',
        replyAll: input.replyAll ?? false,
        sendViaEmail: false,
      },
    })
    if (!response.success) {
      throw new Error(response.error ?? `Failed to reply to message "${input.messageId}"`)
    }
    const id = typeof response.data?.id === 'string' ? response.data.id : input.messageId
    return {
      id,
      parentMessageId: input.messageId,
      commandName: 'messages.messages.reply',
      sendViaEmail: false,
      href: `/backend/messages/${id}`,
    }
  },
}) as MessagesAiToolDefinition

export const aiTools: MessagesAiToolDefinition[] = [
  listMessagesTool,
  getMessageTool,
  sendMessageTool,
  replyMessageTool,
]

export default aiTools
