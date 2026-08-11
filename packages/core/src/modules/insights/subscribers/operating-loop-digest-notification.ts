import type { EntityManager } from '@mikro-orm/postgresql'
import { createLogger } from '@helios/shared/lib/logger'
import { buildFeatureNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { resolveNotificationService } from '../../notifications/lib/notificationService'
import {
  buildOperatingLoopDigestNotification,
  collectOperatingLoopDigestMetrics,
  OPERATING_LOOP_DIGEST_NOTIFICATION_TYPE,
} from '../lib/operatingLoopDigest'
import { notificationTypes } from '../notifications'

const logger = createLogger('insights')

export const metadata = {
  event: 'governance.rules.run',
  persistent: true,
  id: 'insights:operating-loop-digest-notification',
}

type RulesRunPayload = {
  tenantId: string
  organizationId: string
  asOf: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: RulesRunPayload, ctx: ResolverContext) {
  try {
    const em = ctx.resolve<EntityManager>('em')
    const metrics = await collectOperatingLoopDigestMetrics(em, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
      asOf: payload.asOf,
    })
    const digest = buildOperatingLoopDigestNotification({
      organizationId: payload.organizationId,
      asOf: payload.asOf,
      metrics,
    })
    if (!digest) return

    const typeDef = notificationTypes.find((type) => type.type === OPERATING_LOOP_DIGEST_NOTIFICATION_TYPE)
    if (!typeDef) return

    const notificationService = resolveNotificationService(ctx)
    const notificationInput = buildFeatureNotificationFromType(typeDef, {
      requiredFeature: 'insights.view',
      bodyVariables: digest.bodyVariables,
      sourceEntityType: digest.sourceEntityType,
      sourceEntityId: digest.sourceEntityId,
      linkHref: digest.linkHref,
      groupKey: digest.groupKey,
    })

    await notificationService.createForFeature(notificationInput, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
    })
  } catch (err) {
    logger.error('insights.operating-loop-digest Failed to create notification', { err })
  }
}
