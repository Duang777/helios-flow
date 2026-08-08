// Central place to enable modules and their source.
// - id: module id (plural snake_case; special cases: 'auth')
// - from: '@helios/core' | '@app' | custom alias/path in future
// - overrides: optional unified per-app override surface — replace or
//   disable any contract a module presents: AI, routes, events, workers,
//   widgets, notifications, interceptors, setup, ACL, DI, encryption, etc.
//   See `.ai/specs/implemented/2026-05-04-modules-ts-unified-overrides.md` and
//   `apps/docs/docs/framework/modules/overrides.mdx`.
import { parseBooleanWithDefault } from '@helios/shared/lib/boolean'
import type { ModuleOverrides } from '@helios/shared/modules/overrides'
import { officialModuleEntries } from './official-modules.generated'

export type ModuleEntry = {
  id: string
  from?: '@helios/core' | '@app' | string
  overrides?: ModuleOverrides
}

/**
 * Copyable examples for every wired `entry.overrides` domain.
 *
 * This object is intentionally not assigned to any enabled module. Use it as
 * a reference when a downstream app needs to disable or replace contracts
 * from a package-backed module without editing that module's source.
 */
export const moduleOverrideExamples: ModuleOverrides = {
  ai: {
    agents: { 'catalog.catalog_assistant': null },
    tools: { inbox_ops_accept_action: null },
  },
  routes: {
    api: { 'DELETE /api/example/items': null },
    pages: { '/backend/example/reports': null },
  },
  events: {
    subscribers: { 'example.todo.audit': null },
  },
  workers: { 'example:sync': null },
  widgets: {
    injection: { 'example.sidebar': null },
    components: { 'page:/backend/example': null },
    dashboard: { 'example.kpi': null },
  },
  notifications: {
    types: { 'example.notice': null },
    handlers: { 'example.notice.toast': null },
  },
  interceptors: { 'example.items.interceptor': null },
  commandInterceptors: { 'example.command.interceptor': null },
  enrichers: { 'example.items.enricher': null },
  guards: { 'example.backend.guard': null },
  cli: { 'example seed': null },
  setup: {
    seedExamples: false,
  },
  acl: {
    features: { 'example.manage': null },
  },
  di: { exampleService: null },
  encryption: {
    maps: { 'example:item': null },
  },
}

export const enabledModules: ModuleEntry[] = [
  { id: 'dashboards', from: '@helios/core' },
  { id: 'auth', from: '@helios/core' },
  { id: 'directory', from: '@helios/core' },
  { id: 'customers', from: '@helios/core' },
  { id: 'projects', from: '@helios/core' },
  { id: 'commercial', from: '@helios/core' },
  { id: 'perspectives', from: '@helios/core' },
  { id: 'entities', from: '@helios/core' },
  { id: 'configs', from: '@helios/core' },
  { id: 'query_index', from: '@helios/core' },
  { id: 'audit_logs', from: '@helios/core' },
  { id: 'attachments', from: '@helios/core' },
  { id: 'catalog', from: '@helios/core' },
  { id: 'sales', from: '@helios/core' },
  { id: 'wms', from: '@helios/core' },
  { id: 'api_keys', from: '@helios/core' },
  { id: 'dictionaries', from: '@helios/core' },
  { id: 'content', from: '@helios/content' },
  { id: 'onboarding', from: '@helios/onboarding' },
  { id: 'api_docs', from: '@helios/core' },
  { id: 'business_rules', from: '@helios/core' },
  { id: 'feature_toggles', from: '@helios/core' },
  { id: 'workflows', from: '@helios/core' },
  { id: 'search', from: '@helios/search' },
  { id: 'currencies', from: '@helios/core' },
  { id: 'planner', from: '@helios/core' },
  { id: 'resources', from: '@helios/core' },
  { id: 'staff', from: '@helios/core' },
  { id: 'events', from: '@helios/events' },
  { id: 'notifications', from: '@helios/core' },
  { id: 'progress', from: '@helios/core' },
  { id: 'integrations', from: '@helios/core' },
  { id: 'data_sync', from: '@helios/core' },
  { id: 'sync_excel', from: '@helios/core' },
  { id: 'messages', from: '@helios/core' },
  // Communication channels hub (SPEC-045d) — bridges external chat/email channels
  // (Slack, WhatsApp, Email) to the unified Messages inbox. Provider packages
  // (channel-slack, channel-whatsapp, future email providers) register adapters here.
  { id: 'communication_channels', from: '@helios/core' },
  { id: 'ai_assistant', from: '@helios/ai-assistant' },
  { id: 'translations', from: '@helios/core' },
  { id: 'scheduler', from: '@helios/scheduler' },
  { id: 'inbox_ops', from: '@helios/core' },
  { id: 'payment_gateways', from: '@helios/core' },
  { id: 'checkout', from: '@helios/checkout' },
  { id: 'gateway_stripe', from: '@helios/gateway-stripe' },
  // Per-user email channels for the Communications Hub (SPEC-045d / email
  // integration spec). Each provider package registers its `ChannelAdapter`
  // at import time via `setup.ts`; the hub picks them up by `providerKey`.
  { id: 'channel_imap', from: '@helios/channel-imap' },
  { id: 'channel_gmail', from: '@helios/channel-gmail' },
  { id: 'sync_akeneo', from: '@helios/sync-akeneo' },
  { id: 'shipping_carriers', from: '@helios/core' },
  { id: 'webhooks', from: '@helios/webhooks' },
  { id: 'customer_accounts', from: '@helios/core' },
  { id: 'portal', from: '@helios/core' },
  {
    id: 'example',
    from: '@app',
    overrides: {
      routes: {
        api: {
          'GET /api/example/override-probe': {
            handler: async () => Response.json({
              ok: true,
              source: 'modules.ts override',
              route: 'example.override-probe',
            }),
            metadata: { requireAuth: false },
          },
        },
      },
    },
  },
  { id: 'ratelimit_probe', from: '@app' },
]

// Official modules activated via official-modules.json / official-modules.local.json
// (managed by `yarn official-modules`; backed by the external/official-modules submodule).
for (const entry of officialModuleEntries) {
  if (!enabledModules.some((existing) => existing.id === entry.id)) enabledModules.push(entry)
}

if (enabledModules.some((entry) => entry.id === 'example')) {
  enabledModules.push({ id: 'example_customers_sync', from: '@app' })
}

if (parseBooleanWithDefault(process.env.HELIOS_ENABLE_STORAGE_S3, false)) {
  enabledModules.push({ id: 'storage_s3', from: '@helios/storage-s3' })
}

const enterpriseModulesEnabled = parseBooleanWithDefault(process.env.HELIOS_ENABLE_ENTERPRISE_MODULES, false)
const enterpriseSsoEnabled = parseBooleanWithDefault(process.env.HELIOS_ENABLE_ENTERPRISE_MODULES_SSO, false)
const enterpriseSecurityEnabled = parseBooleanWithDefault(process.env.HELIOS_ENABLE_ENTERPRISE_MODULES_SECURITY, false)

if (enterpriseModulesEnabled) {
  enabledModules.push(
    { id: 'record_locks', from: '@helios/enterprise' },
    { id: 'system_status_overlays', from: '@helios/enterprise' },
  )
}

if (enterpriseModulesEnabled && enterpriseSsoEnabled) {
  enabledModules.push({ id: 'sso', from: '@helios/enterprise' })
}

if (enterpriseModulesEnabled && enterpriseSecurityEnabled) {
  enabledModules.push({ id: 'security', from: '@helios/enterprise' })
}
