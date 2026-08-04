import { createRequestContainer } from '@helios/shared/lib/di/container'
import { findOneWithDecryption } from '@helios/shared/lib/encryption/find'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import type { ObjectPreviewData } from '@helios/shared/modules/messages/types'
import type { EntityManager } from '@mikro-orm/postgresql'
import { Currency } from '../data/entities'

type PreviewContext = {
  tenantId: string
  organizationId?: string | null
}

async function resolveEm() {
  const { resolve } = await createRequestContainer()
  return resolve('em') as EntityManager
}

export async function loadCurrencyPreview(
  entityId: string,
  ctx: PreviewContext,
): Promise<ObjectPreviewData> {
  const { t } = await resolveTranslations()
  const defaultTitle = t('currencies.messageObjects.currency.title')

  if (!ctx.organizationId) {
    return { title: defaultTitle, subtitle: entityId }
  }

  const em = await resolveEm()
  const entity = await findOneWithDecryption(
    em,
    Currency,
    {
      id: entityId,
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      deletedAt: null,
    },
    undefined,
    { tenantId: ctx.tenantId, organizationId: ctx.organizationId },
  )

  if (!entity) {
    return {
      title: defaultTitle,
      subtitle: entityId,
      status: t('customers.messageObjects.notFound'),
      statusColor: 'gray',
    }
  }

  const subtitleParts = [entity.code, entity.symbol]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
  const metadata: Record<string, string> = {}
  const codeLabel = t('currencies.form.field.code')
  const symbolLabel = t('currencies.form.field.symbol')
  if (entity.code) metadata[codeLabel] = entity.code
  if (entity.symbol) metadata[symbolLabel] = entity.symbol

  return {
    title: entity.name,
    subtitle: subtitleParts.join(' · ') || entityId,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  }
}
