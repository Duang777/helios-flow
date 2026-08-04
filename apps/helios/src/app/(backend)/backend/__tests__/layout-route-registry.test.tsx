import React from 'react'

const backendRoutes = [
  {
    moduleId: 'auth',
    pattern: '/backend/auth/users',
    pageContext: 'settings' as const,
  },
]

const mockRegisterBackendRouteManifests = jest.fn()

jest.mock('@/.helios/generated/backend-routes.generated', () => ({
  backendRoutes,
}))

jest.mock('@helios/shared/modules/registry', () => ({
  findRouteManifestMatch: jest.fn(() => undefined),
  registerBackendRouteManifests: (...args: unknown[]) => mockRegisterBackendRouteManifests(...args),
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
  headers: jest.fn(),
}))

jest.mock('@helios/shared/lib/auth/server', () => ({
  getAuthFromCookies: jest.fn(),
}))

jest.mock('@helios/ui/backend/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}))

jest.mock('@helios/shared/lib/i18n/server', () => ({
  resolveTranslations: jest.fn(),
}))

jest.mock('@helios/shared/lib/i18n/context', () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

jest.mock('@helios/core/modules/auth/lib/profile-sections', () => ({
  profilePathPrefixes: [],
}))

jest.mock('@helios/shared/lib/version', () => ({
  APP_VERSION: 'test',
}))

jest.mock('@helios/shared/lib/boolean', () => ({
  parseBooleanWithDefault: jest.fn(() => true),
}))

jest.mock('@helios/ui/backend/injection/PageInjectionBoundary', () => ({
  PageInjectionBoundary: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

jest.mock('@/components/DemoFeedbackWidget', () => ({
  DemoFeedbackWidget: () => null,
}))

jest.mock('@/components/OrganizationSwitcher', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/BackendHeaderChrome', () => ({
  BackendHeaderChrome: () => null,
}))

describe('Backend layout route registry', () => {
  beforeEach(() => {
    jest.resetModules()
    mockRegisterBackendRouteManifests.mockClear()
  })

  it('registers backend route manifests at module load', async () => {
    await jest.isolateModulesAsync(async () => {
      await import('../layout')
    })

    expect(mockRegisterBackendRouteManifests).toHaveBeenCalledWith(backendRoutes)
  })
})
