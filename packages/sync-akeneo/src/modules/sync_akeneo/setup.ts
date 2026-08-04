import type { ModuleSetupConfig } from '@helios/shared/modules/setup'
import { createLogger } from '@helios/shared/lib/logger'
import type { CredentialsService } from '@helios/core/modules/integrations/lib/credentials-service'
import type { IntegrationLogService } from '@helios/core/modules/integrations/lib/log-service'
import type { IntegrationStateService } from '@helios/core/modules/integrations/lib/state-service'
import { applyAkeneoEnvPreset } from './lib/preset'

const logger = createLogger('sync_akeneo')

export const setup: ModuleSetupConfig = {
  async seedDefaults({ em, tenantId, organizationId, container }) {
    const credentialsService = container.resolve('integrationCredentialsService') as CredentialsService
    const integrationStateService = container.resolve('integrationStateService') as IntegrationStateService
    const integrationLogService = container.resolve('integrationLogService') as IntegrationLogService

    try {
      await applyAkeneoEnvPreset({
        em,
        credentialsService,
        integrationStateService,
        integrationLogService,
        scope: { tenantId, organizationId },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Akeneo preset error'
      logger.warn('Failed to apply env preset during tenant setup', { err: error })
      await integrationLogService.scoped('sync_akeneo', { tenantId, organizationId }).warn(
        'Akeneo env preset could not be applied during tenant setup.',
        { errorMessage: message },
      )
    }
  },
}

export default setup
