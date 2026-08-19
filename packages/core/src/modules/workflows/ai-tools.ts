import workflowsReadAiTools from './ai-tools/workflows-pack'
import workflowsWriteAiTools from './ai-tools/write-pack'
import type { WorkflowsAiToolDefinition } from './ai-tools/types'

export const aiTools: WorkflowsAiToolDefinition[] = [...workflowsReadAiTools, ...workflowsWriteAiTools]

export default aiTools
