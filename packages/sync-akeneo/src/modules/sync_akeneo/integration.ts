import { buildIntegrationDetailWidgetSpotId, type IntegrationBundle, type IntegrationDefinition } from '@helios/shared/modules/integrations/types'

export const syncAkeneoDetailWidgetSpotId = buildIntegrationDetailWidgetSpotId('sync_akeneo')

export const integration: IntegrationDefinition = {
  id: 'sync_akeneo',
  title: 'Akeneo PIM',
  titleKey: 'integrations.providers.sync_akeneo.title',
  description: 'Import Akeneo product catalogs, family-driven attributes, and products into Helios with resilient batch sync.',
  descriptionKey: 'integrations.providers.sync_akeneo.description',
  category: 'data_sync',
  hub: 'data_sync',
  providerKey: 'akeneo',
  icon: 'database',
  docsUrl: 'https://api.akeneo.com/documentation/authentication.html',
  package: '@helios/sync-akeneo',
  version: '1.0.0',
  author: 'Helios Team',
  company: 'Helios',
  license: 'MIT',
  tags: ['akeneo', 'pim', 'catalog', 'products', 'attributes', 'categories'],
  detailPage: {
    widgetSpotId: syncAkeneoDetailWidgetSpotId,
  },
  credentials: {
    fields: [
      {
        key: 'apiUrl',
        label: 'Akeneo URL',
        labelKey: 'integrations.providers.sync_akeneo.credentials.apiUrl.label',
        type: 'url',
        required: true,
        placeholder: 'https://your-instance.cloud.akeneo.com',
        helpText: 'Use the base Akeneo PIM URL, without a trailing slash.',
        helpTextKey: 'integrations.providers.sync_akeneo.credentials.apiUrl.help',
      },
      {
        key: 'clientId',
        label: 'Client ID',
        labelKey: 'integrations.providers.sync_akeneo.credentials.clientId.label',
        type: 'text',
        required: true,
        helpText: 'Create a connected app or API client in Akeneo and copy its client id.',
        helpTextKey: 'integrations.providers.sync_akeneo.credentials.clientId.help',
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        labelKey: 'integrations.providers.sync_akeneo.credentials.clientSecret.label',
        type: 'secret',
        required: true,
        helpText: 'Use the client secret generated for the Akeneo API connection.',
        helpTextKey: 'integrations.providers.sync_akeneo.credentials.clientSecret.help',
      },
      {
        key: 'username',
        label: 'API Username',
        labelKey: 'integrations.providers.sync_akeneo.credentials.username.label',
        type: 'text',
        required: true,
        helpText: 'Create a dedicated Akeneo user for synchronization and grant only the product/catalog permissions it needs.',
        helpTextKey: 'integrations.providers.sync_akeneo.credentials.username.help',
      },
      {
        key: 'password',
        label: 'API Password',
        labelKey: 'integrations.providers.sync_akeneo.credentials.password.label',
        type: 'secret',
        required: true,
        helpText: 'Use the password for the dedicated Akeneo API user.',
        helpTextKey: 'integrations.providers.sync_akeneo.credentials.password.help',
      },
    ],
  },
  healthCheck: { service: 'akeneoHealthCheck' },
}

export const integrations: IntegrationDefinition[] = [integration]
export const bundles: IntegrationBundle[] = []
export const bundle: IntegrationBundle | undefined = undefined
