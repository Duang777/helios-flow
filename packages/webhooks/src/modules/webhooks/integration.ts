import { buildIntegrationDetailWidgetSpotId, type IntegrationBundle, type IntegrationDefinition } from '@helios/shared/modules/integrations/types'

export const webhookCustomIntegrationId = 'webhook_custom'
export const webhookCustomDetailWidgetSpotId = buildIntegrationDetailWidgetSpotId(webhookCustomIntegrationId)

export const integration: IntegrationDefinition = {
  id: webhookCustomIntegrationId,
  title: 'Custom Webhooks',
  titleKey: 'integrations.providers.webhook_custom.title',
  description: 'Send and receive webhooks using the Standard Webhooks specification.',
  descriptionKey: 'integrations.providers.webhook_custom.description',
  category: 'webhook',
  hub: 'webhook_endpoints',
  providerKey: webhookCustomIntegrationId,
  icon: 'webhook',
  package: '@helios/webhooks',
  version: '1.0.0',
  author: 'Helios Team',
  company: 'Helios',
  license: 'MIT',
  tags: ['webhooks', 'automation', 'events', 'standard-webhooks'],
  detailPage: {
    widgetSpotId: webhookCustomDetailWidgetSpotId,
    hiddenTabs: ['credentials', 'health', 'logs'],
  },
  defaultState: {
    isEnabled: true,
  },
  credentials: {
    fields: [
      {
        key: 'notifyOnFailedDelivery',
        label: 'Notify Admins On Failed Delivery',
        labelKey: 'integrations.providers.webhook_custom.credentials.notifyOnFailedDelivery.label',
        type: 'boolean',
        helpText: 'Send an in-app notification to admin users when a webhook delivery finally fails after retries are exhausted.',
        helpTextKey: 'integrations.providers.webhook_custom.credentials.notifyOnFailedDelivery.help',
      },
    ],
  },
}

export const integrations: IntegrationDefinition[] = [integration]
export const bundles: IntegrationBundle[] = []
export const bundle: IntegrationBundle | undefined = undefined
