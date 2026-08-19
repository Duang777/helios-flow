import type { EntityManager } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { defineAiTool } from '@helios/ai-assistant'
import { createAiApiOperationRunner } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolExecutionContext } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolLoadBeforeSingleRecord } from '@helios/ai-assistant/modules/ai_assistant/lib/types'
import { UserTask } from '../data/entities'
import { assertTenantScope, type WorkflowsAiToolDefinition, type WorkflowsToolContext } from './types'

type TaskIdInput = { taskId: string }
type CompleteTaskInput = { taskId: string; formData?: Record<string, unknown>; comments?: string }

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
    }
  },
}) as WorkflowsAiToolDefinition

export const workflowsWriteAiTools: WorkflowsAiToolDefinition[] = [claimTaskTool, completeTaskTool]

export default workflowsWriteAiTools
