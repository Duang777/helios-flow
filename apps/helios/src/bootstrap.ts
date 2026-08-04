/**
 * App-level bootstrap file
 *
 * This thin wrapper imports generated files and passes them to the
 * shared bootstrap factory. The actual bootstrap logic lives in
 * @helios/shared/lib/bootstrap.
 *
 * This file is imported by layout.tsx and API routes to initialize
 * the application before any package code executes.
 */

// Register app dictionary loader before bootstrap (required for i18n in standalone packages)
import './lib/i18n/register-dictionary-loader'
import { register as registerAppDi } from '@/di'

// modules.ts inline overrides (replace/disable any contract a module
// presents through the unified modules.ts override surface).
// Importing @helios/ai-assistant here also runs the side-effect
// that registers the AI domain applier with the umbrella dispatcher.
import { enabledModules } from '@/modules'
import { applyModuleOverridesFromEnabledModules } from '@helios/shared/modules/overrides'
import '@helios/ai-assistant'

applyModuleOverridesFromEnabledModules(enabledModules)

// Generated imports (static - works with bundlers)
import { modules } from '@/.helios/generated/modules.bootstrap.generated'
import { entities } from '@/.helios/generated/entities.generated'
import { diRegistrars } from '@/.helios/generated/di.generated'
import { E } from '@/.helios/generated/entities.ids.generated'
import { entityFieldsRegistry } from '@/.helios/generated/entity-fields-registry'
import { dashboardWidgetEntries } from '@/.helios/generated/dashboard-widgets.generated'
import { injectionWidgetEntries } from '@/.helios/generated/injection-widgets.generated'
// Side-effect: registers translatable fields (must be before injection-tables which reads the registry)
import '@/.helios/generated/translations-fields.generated'
import { injectionTables } from '@/.helios/generated/injection-tables.generated'
import { searchModuleConfigs } from '@/.helios/generated/search.generated'
import { eventModuleConfigs, allEvents } from '@/.helios/generated/events.generated'
import { registerEventModuleConfigs } from '@helios/shared/modules/events'
import { analyticsModuleConfigs } from '@/.helios/generated/analytics.generated'
import { enricherEntries } from '@/.helios/generated/enrichers.generated'
import { interceptorEntries } from '@/.helios/generated/interceptors.generated'
import { componentOverrideEntries } from '@/.helios/generated/component-overrides.generated'
import { guardEntries } from '@/.helios/generated/guards.generated'
import { commandInterceptorEntries } from '@/.helios/generated/command-interceptors.generated'
import { commandLoaderEntries } from '@/.helios/generated/command-loaders.generated'
import { notificationHandlerEntries } from '@/.helios/generated/notification-handlers.generated'
import { messageTypes } from '@/.helios/generated/message-types.generated'
import { messageObjectTypes } from '@/.helios/generated/message-objects.generated'
import { registerMessageTypes } from '@helios/core/modules/messages/lib/message-types-registry'
import { registerMessageObjectTypes } from '@helios/core/modules/messages/lib/message-objects-registry'
import { runBootstrapRegistrations } from '@/.helios/generated/bootstrap-registrations.generated'
import { allCodeWorkflows } from '@/.helios/generated/workflows.generated'
import { registerCodeWorkflows } from '@helios/core/modules/workflows/lib/code-registry'

// Register event configs globally (similar to search)
registerEventModuleConfigs(eventModuleConfigs)
registerMessageTypes(messageTypes, { replace: true })
registerMessageObjectTypes(messageObjectTypes, { replace: true })
registerCodeWorkflows(allCodeWorkflows)
runBootstrapRegistrations()

// Bootstrap factory from shared package
import { createBootstrap, isBootstrapped } from '@helios/shared/lib/bootstrap'

// Create bootstrap function with app's generated data
export const bootstrap = createBootstrap(
  {
    modules,
    entities,
    diRegistrars,
    entityIds: E,
    entityFieldsRegistry,
    dashboardWidgetEntries,
    injectionWidgetEntries,
    injectionTables,
    searchModuleConfigs,
    analyticsModuleConfigs,
    enricherEntries,
    interceptorEntries,
    componentOverrideEntries,
    guardEntries,
    commandInterceptorEntries,
    commandLoaderEntries,
    notificationHandlerEntries,
  },
  { appDiRegistrar: registerAppDi },
)

export { isBootstrapped }
