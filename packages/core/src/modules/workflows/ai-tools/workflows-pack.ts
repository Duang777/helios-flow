import { z } from 'zod'
import { defineApiBackedAiTool } from '@helios/ai-assistant/modules/ai_assistant/lib/api-backed-tool'
import type { AiApiOperationRequest } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import {
  assertTenantScope,
  type WorkflowsAiToolDefinition,
  type WorkflowsToolContext,
} from './types'

const listInstancesInput = z.object({
  workflowId: z.string().optional(),
  status: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  correlationKey: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
})

const listTasksInput = z.object({
  status: z.string().optional(),
  assignedTo: z.string().optional(),
  workflowInstanceId: z.string().uuid().optional(),
  overdue: z.boolean().optional(),
  myTasks: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
})

type PagedApiResponse = {
  data?: unknown
  pagination?: { total?: number; limit?: number; offset?: number }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function mapInstance(row: Record<string, unknown>): Record<string, unknown> {
  const id = typeof row.id === 'string' ? row.id : null
  const metadata = asRecord(row.metadata)
  return {
    id,
    workflowId: row.workflowId ?? null,
    status: row.status ?? null,
    currentStepId: row.currentStepId ?? null,
    correlationKey: row.correlationKey ?? null,
    entityType: metadata?.entityType ?? null,
    entityId: metadata?.entityId ?? null,
    startedAt: row.startedAt ?? null,
    completedAt: row.completedAt ?? null,
    errorMessage: row.errorMessage ?? null,
    href: id ? `/backend/instances/${id}` : null,
  }
}

function mapTask(row: Record<string, unknown>, includeFormSchema: boolean): Record<string, unknown> {
  const id = typeof row.id === 'string' ? row.id : null
  return {
    id,
    taskName: row.taskName ?? null,
    status: row.status ?? null,
    assignedTo: row.assignedTo ?? null,
    claimedBy: row.claimedBy ?? null,
    dueDate: row.dueDate ?? null,
    workflowInstanceId: row.workflowInstanceId ?? null,
    ...(includeFormSchema ? { formSchema: row.formSchema ?? null } : {}),
    href: id ? `/backend/tasks/${id}` : null,
  }
}

function mapPaged<T>(
  response: { data?: unknown },
  mapper: (row: Record<string, unknown>) => T,
): { items: T[]; total: number } {
  const payload = asRecord(response.data) ?? {}
  const rows = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray((response as PagedApiResponse).data)
      ? ((response as PagedApiResponse).data as unknown[])
      : []
  const pagination = asRecord(payload.pagination) ?? asRecord((response as PagedApiResponse).pagination)
  const items = rows
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => row !== null)
    .map(mapper)
  return {
    items,
    total: typeof pagination?.total === 'number' ? pagination.total : items.length,
  }
}

const listInstancesTool = defineApiBackedAiTool({
  name: 'workflows.list_instances',
  displayName: 'List workflow instances',
  description: 'List workflow instances for the caller tenant. Filter by workflowId, status, or related entity.',
  inputSchema: listInstancesInput,
  requiredFeatures: ['workflows.instances.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as WorkflowsToolContext)
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/workflows/instances',
      query: {
        workflowId: input.workflowId,
        status: input.status,
        entityType: input.entityType,
        entityId: input.entityId,
        correlationKey: input.correlationKey,
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      },
    }
    return operation
  },
  mapResponse: (response) => mapPaged(response, mapInstance),
}) as unknown as WorkflowsAiToolDefinition

const getInstanceTool = defineApiBackedAiTool({
  name: 'workflows.get_instance',
  displayName: 'Get workflow instance',
  description: 'Fetch one workflow instance by id. Returns status, related entity ids, and href. Omits raw context.',
  inputSchema: z.object({ instanceId: z.string().uuid() }),
  requiredFeatures: ['workflows.instances.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as WorkflowsToolContext)
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: `/workflows/instances/${input.instanceId}`,
    }
    return operation
  },
  mapResponse: (response) => {
    const payload = asRecord(response.data)
    const row = asRecord(payload?.data) ?? payload
    if (!row || typeof row.id !== 'string') return null
    return mapInstance(row)
  },
}) as unknown as WorkflowsAiToolDefinition

const listTasksTool = defineApiBackedAiTool({
  name: 'workflows.list_tasks',
  displayName: 'List workflow tasks',
  description: 'List user tasks. Filter by status, assignee, instance, overdue, or myTasks.',
  inputSchema: listTasksInput,
  requiredFeatures: ['workflows.tasks.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as WorkflowsToolContext)
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: '/workflows/tasks',
      query: {
        status: input.status,
        assignedTo: input.assignedTo,
        workflowInstanceId: input.workflowInstanceId,
        overdue: input.overdue === true ? 'true' : undefined,
        myTasks: input.myTasks === true ? 'true' : undefined,
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      },
    }
    return operation
  },
  mapResponse: (response) => mapPaged(response, (row) => mapTask(row, false)),
}) as unknown as WorkflowsAiToolDefinition

const getTaskTool = defineApiBackedAiTool({
  name: 'workflows.get_task',
  displayName: 'Get workflow task',
  description: 'Fetch one user task by id, including formSchema needed before workflows.complete_task.',
  inputSchema: z.object({ taskId: z.string().uuid() }),
  requiredFeatures: ['workflows.tasks.view'],
  toOperation: (input, ctx) => {
    assertTenantScope(ctx as unknown as WorkflowsToolContext)
    const operation: AiApiOperationRequest = {
      method: 'GET',
      path: `/workflows/tasks/${input.taskId}`,
    }
    return operation
  },
  mapResponse: (response) => {
    const payload = asRecord(response.data)
    const row = asRecord(payload?.data) ?? payload
    if (!row || typeof row.id !== 'string') return null
    return mapTask(row, true)
  },
}) as unknown as WorkflowsAiToolDefinition

export const workflowsReadAiTools: WorkflowsAiToolDefinition[] = [
  listInstancesTool,
  getInstanceTool,
  listTasksTool,
  getTaskTool,
]

export default workflowsReadAiTools
