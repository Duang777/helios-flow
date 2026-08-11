import { createLogger } from '@helios/shared/lib/logger'
import { NextResponse, type NextRequest } from 'next/server'
import type { OpenApiRouteDoc } from '@helios/shared/lib/openapi'
import { getAuthFromRequest } from '@helios/shared/lib/auth/server'
import { createRequestContainer } from '@helios/shared/lib/di/container'
import type { RbacService } from '@helios/core/modules/auth/services/rbacService'
import { ensureAllModuleToolsLoaded } from '../../../lib/tool-loader'
import { hasRequiredFeatures } from '../../../lib/auth'
import { toolRegistry } from '../../../lib/tool-registry'
import type { AiToolDefinition } from '../../../lib/types'

const logger = createLogger('ai_assistant')

export const openApi: OpenApiRouteDoc = {
  tag: 'AI Assistant',
  summary: 'List all accessible AI tools',
  methods: {
    GET: {
      operationId: 'aiAssistantListTools',
      summary: 'List the AI tools the caller is allowed to invoke.',
      description:
        'Returns `{ tools: [...], total }` — the subset of every registered AI tool ' +
        '(`ai-tools.ts` / `registerMcpTool`) that the authenticated caller can invoke based on each ' +
        "tool's `requiredFeatures`. Mirrors the `ai_assistant.tools.list` RPC surface so backoffice " +
        'pages (e.g. the playground) can render a global tool inventory without going through the ' +
        'MCP tool transport.',
      responses: [
        { status: 200, description: 'Accessible tool summaries.', mediaType: 'application/json' },
      ],
      errors: [
        { status: 401, description: 'Unauthenticated caller.' },
        { status: 403, description: 'Caller lacks the `ai_assistant.tools.list` feature.' },
        { status: 500, description: 'Internal failure while loading the tool registry.' },
      ],
    },
  },
}

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['ai_assistant.tools.list'] },
}

function summarizeDestructive(
  value: boolean | ((input: unknown) => boolean) | undefined,
): boolean | 'predicate' {
  if (typeof value === 'function') return 'predicate'
  return Boolean(value)
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized', code: 'unauthenticated' }, { status: 401 })
  }

  try {
    const container = await createRequestContainer()
    const rbacService = container.resolve<RbacService>('rbacService')
    const acl = await rbacService.loadAcl(auth.sub, {
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
    })

    await ensureAllModuleToolsLoaded()
    const all = Array.from(toolRegistry.getTools().values())

    const tools = all
      .filter((tool) =>
        hasRequiredFeatures(tool.requiredFeatures, acl.features, acl.isSuperAdmin, rbacService),
      )
      .map((tool) => {
        const def = tool as AiToolDefinition
        return {
          name: def.name,
          displayName: def.displayName ?? def.name,
          description: def.description ?? '',
          tags: def.tags ?? [],
          isMutation: Boolean(def.isMutation),
          isBulk: Boolean(def.isBulk),
          isDestructive: summarizeDestructive(def.isDestructive),
          requiredFeatures: def.requiredFeatures ?? [],
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ tools, total: tools.length })
  } catch (error) {
    logger.error('AI Tools — Failed to list tools', { err: error })
    return NextResponse.json(
      { error: 'Failed to list tools', code: 'internal_error' },
      { status: 500 },
    )
  }
}
