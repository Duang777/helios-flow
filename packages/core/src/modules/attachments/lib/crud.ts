import { E } from '#generated/entities.ids.generated'
import type { CrudEventsConfig, CrudIndexerConfig } from '@helios/shared/lib/crud/types'
import type { Attachment } from '../data/entities'

export const attachmentCrudEvents: CrudEventsConfig<Attachment> = {
  module: 'attachments',
  entity: 'attachment',
  persistent: false,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

export const attachmentCrudIndexer: CrudIndexerConfig<Attachment> = {
  entityType: E.attachments.attachment,
}
