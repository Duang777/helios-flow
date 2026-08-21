import wmsAiTools from './ai-tools/wms-pack'
import wmsWriteAiTools from './ai-tools/write-pack'
import type { WmsAiToolDefinition } from './ai-tools/types'

export const aiTools: WmsAiToolDefinition[] = [...wmsAiTools, ...wmsWriteAiTools]

export default aiTools
