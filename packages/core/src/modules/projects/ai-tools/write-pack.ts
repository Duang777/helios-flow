import type { EntityManager } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { defineAiTool } from '@helios/ai-assistant'
import { createAiApiOperationRunner } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolExecutionContext } from '@helios/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolLoadBeforeSingleRecord } from '@helios/ai-assistant/modules/ai_assistant/lib/types'
import { Project, ProjectRisk } from '../data/entities'
import { assertTenantScope, type ProjectsAiToolDefinition, type ProjectsToolContext } from './types'

type ManageProjectInput = z.infer<typeof manageProjectInput>

function resolveEm(ctx: ProjectsToolContext | AiToolExecutionContext): EntityManager {
  return ctx.container.resolve<EntityManager>('em')
}

function recordVersionFromUpdatedAt(updatedAt: Date | null | undefined): string | null {
  return updatedAt ? updatedAt.toISOString() : null
}

function projectSnapshot(row: Project): Record<string, unknown> {
  return {
    name: row.name,
    code: row.code ?? null,
    status: row.status,
    customerEntityId: row.customerEntityId ?? null,
    dealId: row.dealId ?? null,
    projectManagerId: row.projectManagerId ?? null,
    productLineCode: row.productLineCode ?? null,
    bizCategory: row.bizCategory ?? null,
    budgetRevenue: row.budgetRevenue ?? null,
    budgetCost: row.budgetCost ?? null,
    forecastRevenue: row.forecastRevenue ?? null,
    forecastCost: row.forecastCost ?? null,
    isActive: !!row.isActive,
  }
}

function projectAfter(input: ManageProjectInput): Record<string, unknown> {
  return {
    name: input.name ?? null,
    code: input.code ?? null,
    status: input.status ?? 'draft',
    customerEntityId: input.customerEntityId ?? null,
    dealId: input.dealId ?? null,
    projectManagerId: input.projectManagerId ?? null,
    productLineCode: input.productLineCode ?? null,
    bizCategory: input.bizCategory ?? null,
    budgetRevenue: input.budgetRevenue ?? null,
    budgetCost: input.budgetCost ?? null,
    forecastRevenue: input.forecastRevenue ?? null,
    forecastCost: input.forecastCost ?? null,
    isActive: input.isActive !== false,
  }
}

async function loadProjectForScope(
  em: EntityManager,
  ctx: ProjectsToolContext,
  tenantId: string,
  projectId: string,
): Promise<Project | null> {
  const row = await em.findOne(Project, {
    id: projectId,
    tenantId,
    organizationId: ctx.organizationId ?? undefined,
    deletedAt: null,
  })
  if (!row) return null
  if (ctx.organizationId && row.organizationId !== ctx.organizationId) return null
  return row
}

async function loadProjectPreview(
  input: ManageProjectInput,
  ctx: ProjectsToolContext,
): Promise<AiToolLoadBeforeSingleRecord | null> {
  const { tenantId } = assertTenantScope(ctx)
  const em = resolveEm(ctx)
  if (input.operation === 'create') {
    return {
      recordId: `create:${input.code ?? input.name}`,
      entityType: 'projects.project',
      recordVersion: null,
      before: {
        name: null,
        status: null,
        customerEntityId: null,
        dealId: null,
        projectManagerId: null,
        budgetRevenue: null,
        budgetCost: null,
        forecastRevenue: null,
        forecastCost: null,
      },
      after: projectAfter(input),
    }
  }
  const row = await loadProjectForScope(em, ctx, tenantId, input.projectId!)
  if (!row) return null
  return {
    recordId: row.id,
    entityType: 'projects.project',
    recordVersion: recordVersionFromUpdatedAt(row.updatedAt),
    before: projectSnapshot(row),
  }
}

const manageProjectInput = z
  .object({
    operation: z.enum(['create', 'update']),
    projectId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    code: z.string().trim().max(64).nullable().optional(),
    status: z.enum(['draft', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
    customerEntityId: z.string().uuid().nullable().optional(),
    dealId: z.string().uuid().nullable().optional(),
    projectManagerId: z.string().uuid().nullable().optional(),
    productLineCode: z.string().trim().max(64).nullable().optional(),
    bizCategory: z.string().trim().max(64).nullable().optional(),
    budgetRevenue: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
    budgetCost: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
    forecastRevenue: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
    forecastCost: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.operation === 'create' && !value.name) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'name is required for create.', path: ['name'] })
    }
    if (value.operation === 'update' && !value.projectId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'projectId is required for update.', path: ['projectId'] })
    }
    const hasPatch =
      value.name !== undefined ||
      value.code !== undefined ||
      value.status !== undefined ||
      value.customerEntityId !== undefined ||
      value.dealId !== undefined ||
      value.projectManagerId !== undefined ||
      value.productLineCode !== undefined ||
      value.bizCategory !== undefined ||
      value.budgetRevenue !== undefined ||
      value.budgetCost !== undefined ||
      value.forecastRevenue !== undefined ||
      value.forecastCost !== undefined ||
      value.isActive !== undefined
    if (value.operation === 'update' && !hasPatch) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one project field is required for update.',
        path: ['name'],
      })
    }
  })

const manageProjectTool = defineAiTool({
  name: 'projects.manage_project',
  displayName: 'Manage project',
  description:
    'Create or update a delivery project. The mutation is confirm-required and uses the existing project command routes.',
  inputSchema: manageProjectInput,
  requiredFeatures: ['projects.manage'],
  isMutation: true,
  loadBeforeRecord: loadProjectPreview,
  async handler(rawInput: ManageProjectInput, ctx: ProjectsToolContext) {
    const { tenantId, organizationId } = assertTenantScope(ctx)
    const input = manageProjectInput.parse(rawInput)
    const em = resolveEm(ctx)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)

    if (input.operation === 'create') {
      if (!organizationId) {
        throw new Error('[internal] Organization scope is required to create a project.')
      }
      const response = await runner.run<{ id?: string }>({
        method: 'POST',
        path: '/projects/projects',
        body: {
          tenantId,
          organizationId,
          name: input.name,
          code: input.code ?? null,
          status: input.status,
          customerEntityId: input.customerEntityId ?? null,
          dealId: input.dealId ?? null,
          projectManagerId: input.projectManagerId ?? null,
          productLineCode: input.productLineCode ?? null,
          bizCategory: input.bizCategory ?? null,
          budgetRevenue: input.budgetRevenue ?? null,
          budgetCost: input.budgetCost ?? null,
          forecastRevenue: input.forecastRevenue ?? null,
          forecastCost: input.forecastCost ?? null,
          isActive: input.isActive,
        },
      })
      if (!response.success) {
        throw new Error(response.error ?? 'Failed to create project')
      }
      const projectId = typeof response.data?.id === 'string' ? response.data.id : null
      if (!projectId) {
        throw new Error('Project create succeeded without an id.')
      }
      const after = await loadProjectForScope(em, ctx as ProjectsToolContext, tenantId, projectId)
      return {
        projectId,
        commandName: 'projects.projects.create',
        before: null,
        after: after ? projectSnapshot(after) : projectAfter(input),
      }
    }

    if (!input.projectId) {
      throw new Error('[internal] projectId is required for update.')
    }
    const existing = await loadProjectForScope(em, ctx as ProjectsToolContext, tenantId, input.projectId)
    if (!existing) {
      throw new Error(`Project "${input.projectId}" is not accessible to the caller.`)
    }
    if (!organizationId) {
      throw new Error('[internal] Organization scope is required to update a project.')
    }
    const body: Record<string, unknown> = {
      id: existing.id,
      tenantId,
      organizationId,
    }
    if (input.name !== undefined) body.name = input.name
    if (input.code !== undefined) body.code = input.code
    if (input.status !== undefined) body.status = input.status
    if (input.customerEntityId !== undefined) body.customerEntityId = input.customerEntityId
    if (input.dealId !== undefined) body.dealId = input.dealId
    if (input.projectManagerId !== undefined) body.projectManagerId = input.projectManagerId
    if (input.productLineCode !== undefined) body.productLineCode = input.productLineCode
    if (input.bizCategory !== undefined) body.bizCategory = input.bizCategory
    if (input.budgetRevenue !== undefined) body.budgetRevenue = input.budgetRevenue
    if (input.budgetCost !== undefined) body.budgetCost = input.budgetCost
    if (input.forecastRevenue !== undefined) body.forecastRevenue = input.forecastRevenue
    if (input.forecastCost !== undefined) body.forecastCost = input.forecastCost
    if (input.isActive !== undefined) body.isActive = input.isActive
    const response = await runner.run({
      method: 'PUT',
      path: '/projects/projects',
      body,
    })
    if (!response.success) {
      throw new Error(response.error ?? `Failed to update project "${existing.id}"`)
    }
    const after = await loadProjectForScope(em, ctx as ProjectsToolContext, tenantId, existing.id)
    return {
      projectId: existing.id,
      commandName: 'projects.projects.update',
      before: projectSnapshot(existing),
      after: after ? projectSnapshot(after) : null,
    }
  },
}) as ProjectsAiToolDefinition

const manageRiskInput = z
  .object({
    operation: z.enum(['create', 'update']),
    riskId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    riskType: z.enum(['schedule', 'cost', 'scope', 'other']).optional(),
    status: z.enum(['open', 'mitigating', 'closed']).optional(),
    ownerEmployeeId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.operation === 'create') {
      if (!value.projectId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'projectId is required for create.', path: ['projectId'] })
      }
      if (!value.title) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'title is required for create.', path: ['title'] })
      }
    }
    if (value.operation === 'update' && !value.riskId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'riskId is required for update.', path: ['riskId'] })
    }
    const hasPatch =
      value.title !== undefined ||
      value.description !== undefined ||
      value.riskType !== undefined ||
      value.status !== undefined ||
      value.ownerEmployeeId !== undefined ||
      value.isActive !== undefined ||
      value.projectId !== undefined
    if (value.operation === 'update' && !hasPatch) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one risk field is required for update.',
        path: ['status'],
      })
    }
  })

type ManageRiskInput = z.infer<typeof manageRiskInput>

function riskSnapshot(row: ProjectRisk): Record<string, unknown> {
  return {
    projectId: row.projectId,
    title: row.title,
    description: row.description ?? null,
    riskType: row.riskType,
    status: row.status,
    ownerEmployeeId: row.ownerEmployeeId ?? null,
    isActive: !!row.isActive,
  }
}

function riskAfter(input: ManageRiskInput, before: Record<string, unknown> | null): Record<string, unknown> {
  return {
    projectId: input.projectId ?? before?.projectId ?? null,
    title: input.title ?? before?.title ?? null,
    description: input.description !== undefined ? input.description : (before?.description ?? null),
    riskType: input.riskType ?? before?.riskType ?? null,
    status: input.status ?? before?.status ?? null,
    ownerEmployeeId:
      input.ownerEmployeeId !== undefined ? input.ownerEmployeeId : (before?.ownerEmployeeId ?? null),
    isActive: input.isActive !== undefined ? input.isActive : (before?.isActive ?? true),
  }
}

async function loadRiskForScope(
  em: EntityManager,
  ctx: ProjectsToolContext,
  tenantId: string,
  riskId: string,
): Promise<ProjectRisk | null> {
  const row = await em.findOne(ProjectRisk, {
    id: riskId,
    tenantId,
    organizationId: ctx.organizationId ?? undefined,
    deletedAt: null,
  })
  if (!row) return null
  if (ctx.organizationId && row.organizationId !== ctx.organizationId) return null
  return row
}

async function loadRiskPreview(
  input: ManageRiskInput,
  ctx: ProjectsToolContext,
): Promise<AiToolLoadBeforeSingleRecord | null> {
  const { tenantId } = assertTenantScope(ctx)
  const em = resolveEm(ctx)
  if (input.operation === 'create') {
    return {
      recordId: `create:${input.title ?? input.projectId}`,
      entityType: 'projects.risk',
      recordVersion: null,
      before: {
        projectId: null,
        title: null,
        status: null,
        riskType: null,
        ownerEmployeeId: null,
      },
      after: riskAfter(input, null),
    }
  }
  const row = await loadRiskForScope(em, ctx, tenantId, input.riskId!)
  if (!row) return null
  const before = riskSnapshot(row)
  return {
    recordId: row.id,
    entityType: 'projects.risk',
    recordVersion: recordVersionFromUpdatedAt(row.updatedAt),
    before,
    after: riskAfter(input, before),
  }
}

const manageRiskTool = defineAiTool({
  name: 'projects.manage_risk',
  displayName: 'Manage project risk',
  description:
    'Create or update a delivery risk (status, owner, title). Confirm-required. Prefer update status to mitigating/closed after explaining evidence.',
  inputSchema: manageRiskInput,
  requiredFeatures: ['projects.manage'],
  isMutation: true,
  loadBeforeRecord: loadRiskPreview,
  async handler(rawInput: ManageRiskInput, ctx: ProjectsToolContext) {
    const { tenantId, organizationId } = assertTenantScope(ctx)
    const input = manageRiskInput.parse(rawInput)
    const runner = createAiApiOperationRunner(ctx as unknown as AiToolExecutionContext)

    if (input.operation === 'create') {
      if (!organizationId) {
        throw new Error('[internal] Organization scope is required to create a risk.')
      }
      const response = await runner.run<{ id?: string }>({
        method: 'POST',
        path: '/projects/risks',
        body: {
          tenantId,
          organizationId,
          projectId: input.projectId,
          title: input.title,
          description: input.description ?? null,
          riskType: input.riskType,
          status: input.status,
          ownerEmployeeId: input.ownerEmployeeId ?? null,
          isActive: input.isActive,
        },
      })
      if (!response.success) {
        throw new Error(response.error ?? 'Failed to create risk')
      }
      return {
        riskId: response.data?.id ?? null,
        commandName: 'projects.risks.create',
        href: response.data?.id ? `/backend/risks/${response.data.id}` : '/backend/risks',
      }
    }

    const body: Record<string, unknown> = { id: input.riskId, tenantId, organizationId }
    if (input.projectId !== undefined) body.projectId = input.projectId
    if (input.title !== undefined) body.title = input.title
    if (input.description !== undefined) body.description = input.description
    if (input.riskType !== undefined) body.riskType = input.riskType
    if (input.status !== undefined) body.status = input.status
    if (input.ownerEmployeeId !== undefined) body.ownerEmployeeId = input.ownerEmployeeId
    if (input.isActive !== undefined) body.isActive = input.isActive
    const response = await runner.run({
      method: 'PUT',
      path: '/projects/risks',
      body,
    })
    if (!response.success) {
      throw new Error(response.error ?? `Failed to update risk "${input.riskId}"`)
    }
    return {
      riskId: input.riskId,
      commandName: 'projects.risks.update',
      href: `/backend/risks/${input.riskId}`,
    }
  },
}) as ProjectsAiToolDefinition

export const aiTools: ProjectsAiToolDefinition[] = [manageProjectTool, manageRiskTool]

export default aiTools
