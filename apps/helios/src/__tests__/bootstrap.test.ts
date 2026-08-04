const createBootstrapMock = jest.fn(() => jest.fn())
const registerAppDictionaryLoaderMock = jest.fn()
const registerEventModuleConfigsMock = jest.fn()
const registerMessageTypesMock = jest.fn()
const registerMessageObjectTypesMock = jest.fn()
const runBootstrapRegistrationsMock = jest.fn()
const appDiRegistrarMock = jest.fn()

describe('app bootstrap', () => {
  beforeEach(() => {
    jest.resetModules()
    createBootstrapMock.mockClear()
    registerAppDictionaryLoaderMock.mockClear()
    registerEventModuleConfigsMock.mockClear()
    registerMessageTypesMock.mockClear()
    registerMessageObjectTypesMock.mockClear()
    runBootstrapRegistrationsMock.mockClear()
    appDiRegistrarMock.mockClear()
  })

  it('registers the bootstrap module manifest instead of route-aware registries', async () => {
    const fullModules = [{ id: 'full', backendRoutes: [{ pattern: '/backend/customers' }] }]
    const appModules = [{ id: 'app-only' }]
    const bootstrapModules = [{ id: 'bootstrap-only' }]

    jest.doMock('@helios/shared/lib/i18n/server', () => ({
      registerAppDictionaryLoader: registerAppDictionaryLoaderMock,
    }))
    jest.doMock('@/.helios/generated/modules.generated', () => ({ modules: fullModules }))
    jest.doMock('@/.helios/generated/modules.app.generated', () => ({ modules: appModules }))
    jest.doMock('@/.helios/generated/modules.bootstrap.generated', () => ({ modules: bootstrapModules }), { virtual: true })
    jest.doMock('@/.helios/generated/entities.generated', () => ({ entities: [] }))
    jest.doMock('@/.helios/generated/di.generated', () => ({ diRegistrars: [] }))
    jest.doMock('@/.helios/generated/entities.ids.generated', () => ({ E: {} }))
    jest.doMock('@/.helios/generated/entity-fields-registry', () => ({ entityFieldsRegistry: {} }))
    jest.doMock('@/.helios/generated/dashboard-widgets.generated', () => ({ dashboardWidgetEntries: [] }))
    jest.doMock('@/.helios/generated/injection-widgets.generated', () => ({ injectionWidgetEntries: [] }))
    jest.doMock('@/.helios/generated/translations-fields.generated', () => ({}))
    jest.doMock('@/.helios/generated/injection-tables.generated', () => ({ injectionTables: [] }))
    jest.doMock('@/.helios/generated/search.generated', () => ({ searchModuleConfigs: [] }))
    jest.doMock('@/.helios/generated/events.generated', () => ({ eventModuleConfigs: [], allEvents: [] }))
    jest.doMock('@/.helios/generated/analytics.generated', () => ({ analyticsModuleConfigs: [] }))
    jest.doMock('@/.helios/generated/enrichers.generated', () => ({ enricherEntries: [] }))
    jest.doMock('@/.helios/generated/interceptors.generated', () => ({ interceptorEntries: [] }))
    jest.doMock('@/.helios/generated/component-overrides.generated', () => ({ componentOverrideEntries: [] }))
    jest.doMock('@/.helios/generated/guards.generated', () => ({ guardEntries: [] }))
    jest.doMock('@/.helios/generated/command-interceptors.generated', () => ({ commandInterceptorEntries: [] }))
    jest.doMock('@/.helios/generated/command-loaders.generated', () => ({ commandLoaderEntries: [] }))
    jest.doMock('@/.helios/generated/notification-handlers.generated', () => ({ notificationHandlerEntries: [] }))
    jest.doMock('@/.helios/generated/message-types.generated', () => ({ messageTypes: [] }))
    jest.doMock('@/.helios/generated/message-objects.generated', () => ({ messageObjectTypes: [] }))
    jest.doMock('@/.helios/generated/bootstrap-registrations.generated', () => ({
      runBootstrapRegistrations: runBootstrapRegistrationsMock,
    }))
    jest.doMock('@helios/ai-assistant', () => ({}))
    jest.doMock('@/di', () => ({ register: appDiRegistrarMock }))
    jest.doMock('@helios/shared/modules/events', () => ({
      registerEventModuleConfigs: registerEventModuleConfigsMock,
    }))
    jest.doMock('@helios/core/modules/messages/lib/message-types-registry', () => ({
      registerMessageTypes: registerMessageTypesMock,
    }))
    jest.doMock('@helios/core/modules/messages/lib/message-objects-registry', () => ({
      registerMessageObjectTypes: registerMessageObjectTypesMock,
    }))
    jest.doMock('@helios/shared/lib/bootstrap', () => ({
      createBootstrap: createBootstrapMock,
      isBootstrapped: jest.fn(() => false),
    }))

    await import('@/bootstrap')

    expect(createBootstrapMock).toHaveBeenCalledTimes(1)
    expect(createBootstrapMock.mock.calls[0][0].modules).toBe(bootstrapModules)
    expect(createBootstrapMock.mock.calls[0][0].modules).not.toBe(fullModules)
    expect(createBootstrapMock.mock.calls[0][0].modules).not.toBe(appModules)
    expect(createBootstrapMock.mock.calls[0][1]).toEqual({ appDiRegistrar: appDiRegistrarMock })
  })
})
