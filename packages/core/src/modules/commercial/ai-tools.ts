import commercialAiTools from './ai-tools/commercial-pack'
import commercialWriteAiTools from './ai-tools/write-pack'
import type { CommercialAiToolDefinition } from './ai-tools/types'

export const aiTools: CommercialAiToolDefinition[] = [...commercialAiTools, ...commercialWriteAiTools]

export default aiTools
