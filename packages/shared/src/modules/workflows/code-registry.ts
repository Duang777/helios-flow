/**
 * In-Memory Code Workflow Registry (shared)
 *
 * Single process-wide store for code-based workflow definitions. Lives in
 * `@helios/shared` so every runtime that bootstraps from generated data
 * (Next.js app via `bootstrap.ts`, CLI commands, and the `helios workers`
 * process via `bootstrapFromAppRoot`) populates the same registry the
 * workflows engine reads through `@helios/core`'s `code-registry`
 * bridge. Definitions live purely in memory — no DB row is created until a
 * user customizes the definition.
 */

import { createLogger } from '../../lib/logger'
import type { CodeWorkflowDefinition } from './types'

const logger = createLogger('workflows')

const codeWorkflowRegistry = new Map<string, CodeWorkflowDefinition>()

/**
 * Register code workflow definitions without schema validation.
 *
 * Bootstrap paths that cannot depend on the workflows module's Zod validators
 * (shared bootstrap factory, CLI/workers) register through this entry point;
 * the validating wrapper lives in
 * `@helios/core/modules/workflows/lib/code-registry`.
 */
export function registerCodeWorkflowEntries(workflows: CodeWorkflowDefinition[]): void {
  for (const wf of workflows) {
    if (codeWorkflowRegistry.has(wf.workflowId)) {
      const existing = codeWorkflowRegistry.get(wf.workflowId)
      if (existing !== wf && existing?.moduleId !== wf.moduleId) {
        logger.warn('Duplicate code workflow ID — overwriting', { workflowId: wf.workflowId, moduleId: wf.moduleId })
      }
    }
    codeWorkflowRegistry.set(wf.workflowId, wf)
  }
}

export function getCodeWorkflow(workflowId: string): CodeWorkflowDefinition | undefined {
  return codeWorkflowRegistry.get(workflowId)
}

export function getAllCodeWorkflows(): CodeWorkflowDefinition[] {
  return Array.from(codeWorkflowRegistry.values())
}

export function isCodeWorkflow(workflowId: string): boolean {
  return codeWorkflowRegistry.has(workflowId)
}

export function clearCodeWorkflowRegistry(): void {
  codeWorkflowRegistry.clear()
}
