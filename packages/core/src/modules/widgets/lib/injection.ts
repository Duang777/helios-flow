// Re-export from shared for backward compatibility
// New code should import directly from @helios/shared/modules/widgets/injection-loader
export {
  registerCoreInjectionWidgets,
  getCoreInjectionWidgets,
  registerCoreInjectionTables,
  getCoreInjectionTables,
  registerEnabledModuleIds,
  getEnabledModuleIds,
  invalidateInjectionWidgetCache,
  loadAllInjectionWidgets,
  loadInjectionDataWidgetById,
  loadInjectionDataWidgetsForSpot,
  loadInjectionWidgetById,
  loadInjectionWidgetsForSpot,
  type LoadedInjectionDataWidget,
  type LoadedInjectionWidget,
} from '@helios/shared/modules/widgets/injection-loader'
