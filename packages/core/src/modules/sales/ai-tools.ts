import salesAiTools from './ai-tools/sales-pack'
import salesWriteAiTools from './ai-tools/write-pack'
import type { SalesAiToolDefinition } from './ai-tools/types'

export const aiTools: SalesAiToolDefinition[] = [...salesAiTools, ...salesWriteAiTools]

export default aiTools
