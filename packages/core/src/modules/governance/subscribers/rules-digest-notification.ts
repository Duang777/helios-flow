import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../notifications'
import { GovernanceFinding } from '../data/entities'
import { createLogger } from '@helios/shared/lib/logger'

const logger = createLogger('governance')

export const metadata = {
  event: 'governance.rules.run',
  persistent: true,
  id: 'governance:rules-digest-notification',
}

type RulesRunPayload = {
  tenantId: string
  organizationId: string
  asOf: string
  created?: number
  updated?: number
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: RulesRunPayload, ctx: ResolverContext) {
  try {
    const em = ctx.resolve<EntityManager>('em')
    const criticalCount = await em.count(GovernanceFinding, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
      asOf: payload.asOf,
      severity: 'critical',
      status: 'open',
      deletedAt: null,
    })
    if (criticalCount <= 0) return

    const typeDef = notificationTypes.find((type) => type.type === 'governance.rules.digest')
    if (!typeDef) return

    const notificationService = resolveNotificationService(ctx)
    const notificationInput = buildFeatureNotificationFromType(typeDef, {
      requiredFeature: 'governance.view',
      bodyVariables: {
        criticalCount: String(criticalCount),
        asOf: payload.asOf,
      },
      sourceEntityType: 'governance.rules',
      sourceEntityId: payload.organizationId,
      linkHref: '/backend/governance/findings?status=open&severity=critical',
      groupKey: `governance.rules:${payload.organizationId}:${payload.asOf}`,
    })

    await notificationService.createForFeature(notificationInput, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
    })
  } catch (err) {
    logger.error('governance.rules-digest Failed to create notification', { err })
  }
}
