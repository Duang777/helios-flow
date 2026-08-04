import { createCrudOpenApiFactory } from '@helios/shared/lib/openapi/crud'

export const buildWebhooksCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: 'Webhooks',
})
