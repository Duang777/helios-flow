import type { ModuleSetupConfig } from '@helios/shared/modules/setup'
import { createLogger } from '@helios/shared/lib/logger'
import { createCredentialsService } from '@helios/core/modules/integrations/lib/credentials-service'
import { createIntegrationLogService } from '@helios/core/modules/integrations/lib/log-service'
import { createIntegrationStateService } from '@helios/core/modules/integrations/lib/state-service'
import { applyStripeEnvPreset } from './lib/preset'

const logger = createLogger('gateway_stripe')

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['gateway_stripe.view', 'gateway_stripe.configure'],
    admin: ['gateway_stripe.view', 'gateway_stripe.configure'],
  },

  async onTenantCreated({ em, organizationId, tenantId }) {
    try {
      await applyStripeEnvPreset({
        credentialsService: createCredentialsService(em),
        integrationStateService: createIntegrationStateService(em),
        integrationLogService: createIntegrationLogService(em),
        scope: { tenantId, organizationId },
      })
    } catch (error) {
      logger.warn('Failed to apply env preset during tenant setup', { err: error })
    }
  },
}

export default setup
