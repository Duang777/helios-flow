import type { EntityManager } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { defineAiTool } from '@helios/ai-assistant'
import { createAiApiOperationRunner } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolExecutionContext } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolLoadBeforeSingleRecord } from '@helios/ai-assistant/modules/ai_assistant/lib/types'
import { UserTask, WorkflowInstance } from '../data/entities'
import { assertTenantScope, type WorkflowsAiToolDefinition, type WorkflowsToolContext } from './types'

type TaskIdInput = { taskId: string }
type CompleteTaskInput = { taskId: string; formData?: Record<string, unknown>; comments?: string }
type StartInstanceInput = {
  workflowId: string
  version?: number
  correlationKey?: string
  initialContext?: Record<string, unknown>
}
type InstanceIdInput = { instanceId: string }

function resolveEm(ctx: WorkflowsToolContext | AiToolExecutionContext): EntityManager {
  return ctx.container.resolve<EntityManager>('em')
}

function recordVersionFromUpdatedAt(updatedAt: Date | null | undefined): string | null {
  return updatedAt ? updatedAt.toISOString() : null
}

function taskSnapshot(row: UserTask): Record<string, unknown> {
  return {
    taskName: row.taskName,
    status: row.status,
    assignedTo: row.assignedTo ?? null,
    claimedBy: row.claimedBy ?? null,
    dueDate: row.dueDate ?? null,
    workflowInstanceId: row.workflowInstanceId,
    comments: row.comments ?? null,
  }
}

function instanceSnapshot(row: WorkflowInstance): Record<string, unknown> {
  return {
    workflowId: row.workflowId,
    status: row.status,
    currentStepId: row.currentStepId ?? null,
    correlationKey: row.correlationKey ?? null,
    version: row.version ?? null,
  }
}

async function loadTaskForScope(
  em: EntityManager,
  ctx: WorkflowsToolContext,
  tenantId: string,
  taskId: string,
): Promise<UserTask | null> {
  const row = await em.findOne(UserTask, {
    id: taskId,
    tenantId,
    organizationId: ctx.organizationId ?? undefined,
  })
  if (!row) return null
  if (ctx.organizationId && row.organizationId !== ctx.organizationId) return null
  return row
}

async function loadInstanceForScope(
  em: EntityManager,
  ctx: WorkflowsToolContext,
  tenantId: string,
  instanceId: string,
): Promise<WorkflowInstance | null> {
  const row = await em.findOne(WorkflowInstance, {
    id: instanceId,
    tenantId,
    organizationId: ctx.organizationId ?? undefined,
  })
  if (!row) return null
  if (ctx.organizationId && row.organizationId !== ctx.organizationId) return null
  return row
}

async function loadTaskPreview(
  input: { taskId: string },
  ctx: WorkflowsToolContext,
): Promise<AiToolLoadBeforeSingleRecord | null> {
  const { tenantId } = assertTenantScope(ctx)
  const row = await loadTaskForScope(resolveEm(ctx), ctx, tenantId, input.taskId)
  if (!row) return null
  return {
    recordId: row.id,
    entityType: 'workflows.task',
    recordVersion: recordVersionFromUpdatedAt(row.updatedAt),
    before: taskSnapshot(row),
  }
}

async function loadInstancePreview(
  input: { instanceId: string },
  ctx: WorkflowsToolContext,
): Promise<AiToolLoadBeforeSingleRecord | null> {
  const { tenantId } = assertTenantScope(ctx)
  const row = await loadInstanceForScope(resolveEm(ctx), ctx, tenantId, input.instanceId)
  if (!row) return null
  return {
    recordId: row.id,
    entityType: 'workflows.instance',
    recordVersion: recordVersionFromUpdatedAt(row.updatedAt),
    before: instanceSnapshot(row),
  }
}

async function previewStartInstance(
  input: StartInstanceInput,
  _ctx: WorkflowsToolContext,
): Promise<AiToolLoadBeforeSingleRecord> {
  return {
    recordId: `start:${input.workflowId}`,
    entityType: 'workflows.instance',
    recordVersion: null,
    before: {
      workflowId: null,
      status: null,
      version: null,
      correlationKey: null,
    },
    after: {
      workflowId: input.workflowId,
      status: 'starting',
      version: input.version ?? null,
      correlationKey: input.correlationKey ?? null,
    },
  }
}

const claimTaskTool = defineAiTool({
  name: 'workflows.claim_task',
  displayName: 'Claim workflow task',
  description: 'Claim a pending user task for the current user. Requires confirmation.',
  inputSchema: z.object({ taskId: z.string().uuid() }),
  requiredFeatures: ['workflows.tasks.claim'],
  isMutation: true,
  loadBeforeRecord: loadTaskPreview,
  async handler(rawInput: TaskIdInput, ctx: WorkflowsToolContext) {
    const { tenantId } = assertTenantScope(ctx)
    const input = z.object({ taskId: z.string().uuid() }).parse(rawInput)
    const em = resolveEm(ctx)
    const existing = await loadTaskForScope(em, ctx, tenantId, input.taskId)
    if (!existing) throw new Error(`Task "${input.taskId}" is not accessible to the caller.`)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)
    const response = await runner.run({
      method: 'POST',
      path: `/workflows/tasks/${existing.id}/claim`,
      body: {},
    })
    if (!response.success) throw new Error(response.error ?? `Failed to claim task "${existing.id}"`)
    const after = await loadTaskForScope(em, ctx, tenantId, existing.id)
    return {
      taskId: existing.id,
      commandName: 'workflows.tasks.claim',
      before: taskSnapshot(existing),
      after: after ? taskSnapshot(after) : null,
      href: `/backend/workflows/tasks/${existing.id}`,
    }
  },
}) as WorkflowsAiToolDefinition

const completeTaskTool = defineAiTool({
  name: 'workflows.complete_task',
  displayName: 'Complete workflow task',
  description:
    'Complete a claimed user task with formData matching the task formSchema. Call workflows.get_task first. Requires confirmation.',
  inputSchema: z.object({
    taskId: z.string().uuid(),
    formData: z.record(z.string(), z.unknown()).optional(),
    comments: z.string().optional(),
  }),
  requiredFeatures: ['workflows.tasks.complete'],
  isMutation: true,
  loadBeforeRecord: loadTaskPreview,
  async handler(rawInput: CompleteTaskInput, ctx: WorkflowsToolContext) {
    const { tenantId } = assertTenantScope(ctx)
    const input = z
      .object({
        taskId: z.string().uuid(),
        formData: z.record(z.string(), z.unknown()).optional(),
        comments: z.string().optional(),
      })
      .parse(rawInput)
    const em = resolveEm(ctx)
    const existing = await loadTaskForScope(em, ctx, tenantId, input.taskId)
    if (!existing) throw new Error(`Task "${input.taskId}" is not accessible to the caller.`)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)
    const response = await runner.run({
      method: 'POST',
      path: `/workflows/tasks/${existing.id}/complete`,
      body: {
        formData: input.formData ?? {},
        comments: input.comments,
      },
    })
    if (!response.success) throw new Error(response.error ?? `Failed to complete task "${existing.id}"`)
    const after = await loadTaskForScope(em, ctx, tenantId, existing.id)
    return {
      taskId: existing.id,
      commandName: 'workflows.tasks.complete',
      before: taskSnapshot(existing),
      after: after ? taskSnapshot(after) : null,
      href: `/backend/workflows/tasks/${existing.id}`,
    }
  },
}) as WorkflowsAiToolDefinition

const startInstanceTool = defineAiTool({
  name: 'workflows.start_instance',
  displayName: 'Start workflow instance',
  description:
    'Start a new workflow instance from a published definition id. Confirm-required. Do not claim the instance started until the approval card is confirmed.',
  inputSchema: z.object({
    workflowId: z.string().min(1),
    version: z.number().int().positive().optional(),
    correlationKey: z.string().optional(),
    initialContext: z.record(z.string(), z.unknown()).optional(),
  }),
  requiredFeatures: ['workflows.instances.create'],
  isMutation: true,
  loadBeforeRecord: previewStartInstance,
  async handler(rawInput: StartInstanceInput, ctx: WorkflowsToolContext) {
    assertTenantScope(ctx)
    const input = z
      .object({
        workflowId: z.string().min(1),
        version: z.number().int().positive().optional(),
        correlationKey: z.string().optional(),
        initialContext: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(rawInput)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)
    const response = await runner.run<{ data?: { instance?: { id?: string } }; instance?: { id?: string } }>({
      method: 'POST',
      path: '/workflows/instances',
      body: {
        workflowId: input.workflowId,
        version: input.version,
        correlationKey: input.correlationKey,
        initialContext: input.initialContext ?? {},
      },
    })
    if (!response.success) {
      throw new Error(response.error ?? `Failed to start workflow "${input.workflowId}"`)
    }
    const instanceId =
      response.data?.data?.instance?.id ??
      response.data?.instance?.id ??
      null
    return {
      workflowId: input.workflowId,
      instanceId,
      commandName: 'workflows.instances.create',
      href: instanceId ? `/backend/workflows/instances/${instanceId}` : '/backend/workflows/instances',
    }
  },
}) as WorkflowsAiToolDefinition

const cancelInstanceTool = defineAiTool({
  name: 'workflows.cancel_instance',
  displayName: 'Cancel workflow instance',
  description:
    'Cancel a running or paused workflow instance. Confirm-required. Call workflows.get_instance first.',
  inputSchema: z.object({ instanceId: z.string().uuid() }),
  requiredFeatures: ['workflows.instances.cancel'],
  isMutation: true,
  loadBeforeRecord: loadInstancePreview,
  async handler(rawInput: InstanceIdInput, ctx: WorkflowsToolContext) {
    const { tenantId } = assertTenantScope(ctx)
    const input = z.object({ instanceId: z.string().uuid() }).parse(rawInput)
    const em = resolveEm(ctx)
    const existing = await loadInstanceForScope(em, ctx, tenantId, input.instanceId)
    if (!existing) throw new Error(`Instance "${input.instanceId}" is not accessible to the caller.`)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)
    const response = await runner.run({
      method: 'POST',
      path: `/workflows/instances/${existing.id}/cancel`,
      body: {},
    })
    if (!response.success) {
      throw new Error(response.error ?? `Failed to cancel instance "${existing.id}"`)
    }
    const after = await loadInstanceForScope(em, ctx, tenantId, existing.id)
    return {
      instanceId: existing.id,
      commandName: 'workflows.instances.cancel',
      before: instanceSnapshot(existing),
      after: after ? instanceSnapshot(after) : null,
      href: `/backend/workflows/instances/${existing.id}`,
    }
  },
}) as WorkflowsAiToolDefinition

const retryInstanceTool = defineAiTool({
  name: 'workflows.retry_instance',
  displayName: 'Retry workflow instance',
  description:
    'Retry a failed workflow instance. Confirm-required. Call workflows.get_instance first to confirm status=failed.',
  inputSchema: z.object({ instanceId: z.string().uuid() }),
  requiredFeatures: ['workflows.instances.retry'],
  isMutation: true,
  loadBeforeRecord: loadInstancePreview,
  async handler(rawInput: InstanceIdInput, ctx: WorkflowsToolContext) {
    const { tenantId } = assertTenantScope(ctx)
    const input = z.object({ instanceId: z.string().uuid() }).parse(rawInput)
    const em = resolveEm(ctx)
    const existing = await loadInstanceForScope(em, ctx, tenantId, input.instanceId)
    if (!existing) throw new Error(`Instance "${input.instanceId}" is not accessible to the caller.`)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)
    const response = await runner.run({
      method: 'POST',
      path: `/workflows/instances/${existing.id}/retry`,
      body: {},
    })
    if (!response.success) {
      throw new Error(response.error ?? `Failed to retry instance "${existing.id}"`)
    }
    const after = await loadInstanceForScope(em, ctx, tenantId, existing.id)
    return {
      instanceId: existing.id,
      commandName: 'workflows.instances.retry',
      before: instanceSnapshot(existing),
      after: after ? instanceSnapshot(after) : null,
      href: `/backend/workflows/instances/${existing.id}`,
    }
  },
}) as WorkflowsAiToolDefinition

export const workflowsWriteAiTools: WorkflowsAiToolDefinition[] = [
  claimTaskTool,
  completeTaskTool,
  startInstanceTool,
  cancelInstanceTool,
  retryInstanceTool,
]

export default workflowsWriteAiTools
