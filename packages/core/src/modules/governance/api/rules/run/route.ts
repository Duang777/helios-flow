import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@helios/shared/lib/openapi'
import { createRequestContainer } from '@helios/shared/lib/di/container'
import { getAuthFromRequest } from '@helios/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@helios/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@helios/shared/lib/commands'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { CrudHttpError, isCrudHttpError } from '@helios/shared/lib/crud/errors'
import { parseScopedCommandInput } from '@helios/shared/lib/api/scoped'
import { rulesRunSchema } from '../../../data/validators'
import {
  validateCrudMutationGuard,
  runCrudMutationGuardAfterSuccess,
} from '@helios/shared/lib/crud/mutation-guard'
import type { RulesRunResult } from '../../../commands/rules-run'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['governance.manage'] },
}

type RequestContext = {
  ctx: CommandRuntimeContext
}

async function resolveRequestContext(req: Request): Promise<RequestContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  const { translate } = await resolveTranslations()

  if (!auth || !auth.tenantId) {
    throw new CrudHttpError(401, { error: translate('governance.rules.errors.unauthorized', 'Unauthorized') })
  }

  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const organizationId = scope?.selectedId ?? auth.orgId ?? null
  if (!organizationId) {
    throw new CrudHttpError(400, {
      error: translate('governance.rules.errors.organizationRequired', 'Organization context is required'),
    })
  }

  const ctx: CommandRuntimeContext = {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: organizationId,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }

  return { ctx }
}

function resolveUserId(auth: unknown): string {
  const sub = (auth as { sub?: unknown })?.sub
  return typeof sub === 'string' ? sub : 'unknown'
}

export async function POST(req: Request) {
  try {
    const { ctx } = await resolveRequestContext(req)
    const { translate } = await resolveTranslations()
    const payload = await req.json().catch(() => ({}))
    const input = parseScopedCommandInput(rulesRunSchema, payload, ctx, translate)

    const guardInput = {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      userId: resolveUserId(ctx.auth),
      resourceKind: 'governance.rules',
      resourceId: input.organizationId,
      operation: 'update' as const,
      requestMethod: req.method,
      requestHeaders: req.headers,
    }
    const guardResult = await validateCrudMutationGuard(ctx.container, {
      ...guardInput,
      mutationPayload: input,
    })
    if (guardResult && !guardResult.ok) {
      return NextResponse.json(guardResult.body, { status: guardResult.status })
    }

    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<typeof input, RulesRunResult>('governance.rules.run', {
      input,
      ctx,
    })

    if (guardResult?.ok && guardResult.shouldRunAfterSuccess) {
      await runCrudMutationGuardAfterSuccess(ctx.container, {
        ...guardInput,
        metadata: guardResult.metadata ?? null,
      })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('governance.rules.errors.runFailed', 'Failed to run governance rules') },
      { status: 400 },
    )
  }
}

const rulesRunResponseSchema = z.object({
  ok: z.boolean(),
  created: z.number(),
  updated: z.number(),
  asOf: z.string(),
  ruleCount: z.number(),
  candidateCount: z.number(),
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Governance',
  summary: 'Run governance rule pack',
  methods: {
    POST: {
      summary: 'Run governance rule pack',
      description:
        'Executes built-in governance detectors for the organization and upserts findings idempotently by (ruleId, subjectType, subjectId, asOf).',
      requestBody: {
        schema: rulesRunSchema,
      },
      responses: [
        {
          status: 200,
          description: 'Rule run summary',
          schema: rulesRunResponseSchema,
        },
      ],
    },
  },
}
