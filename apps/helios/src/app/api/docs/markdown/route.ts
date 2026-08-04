import { modules } from '@/.helios/generated/modules.runtime.generated'
import { apiRoutes } from '@/.helios/generated/api-routes.generated'
import { resolveApiDocsBaseUrl } from '@helios/core/modules/api_docs/lib/resources'
import { attachOpenApiDocsToModules, buildOpenApiDocument, generateMarkdownFromOpenApi, sanitizeOpenApiDocument } from '@helios/shared/lib/openapi'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { APP_VERSION } from '@helios/shared/lib/version'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { t } = await resolveTranslations()
  const baseUrl = resolveApiDocsBaseUrl()
  const docModules = await attachOpenApiDocsToModules(modules, apiRoutes)
  const rawDoc = buildOpenApiDocument(docModules, {
    title: t('api.docs.title', 'Helios API'),
    version: APP_VERSION,
    description: t('api.docs.description', 'Auto-generated OpenAPI definition for all enabled modules.'),
    servers: [{ url: baseUrl, description: t('api.docs.serverDescription', 'Default environment') }],
    baseUrlForExamples: baseUrl,
    defaultSecurity: ['bearerAuth'],
  })
  const doc = sanitizeOpenApiDocument(rawDoc)
  const markdown = generateMarkdownFromOpenApi(doc)
  return new Response(markdown, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
