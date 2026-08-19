import projectsAiTools from './ai-tools/projects-pack'
import projectsWriteAiTools from './ai-tools/write-pack'
import type { ProjectsAiToolDefinition } from './ai-tools/types'

export const aiTools: ProjectsAiToolDefinition[] = [...projectsAiTools, ...projectsWriteAiTools]

export default aiTools
