import type { EntityManager } from '@mikro-orm/postgresql'
import { createIntegrationStateService } from '@helios/core/modules/integrations/lib/state-service'
import type { IntegrationScope } from '@helios/shared/modules/integrations/types'
import { webhookCustomIntegrationId } from '../integration'

export const WEBHOOK_INTEGRATION_DISABLED_MESSAGE = 'Custom Webhooks integration is disabled'

export async function isWebhookIntegrationEnabled(
  em: EntityManager,
  scope: IntegrationScope,
): Promise<boolean> {
  const stateService = createIntegrationStateService(em)
  return stateService.isEnabled(webhookCustomIntegrationId, scope)
}
