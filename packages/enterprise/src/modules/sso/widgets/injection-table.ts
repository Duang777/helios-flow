import type { ModuleInjectionTable } from '@helios/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'auth.login:form': [
    {
      widgetId: 'sso.injection.login-sso',
      priority: 100,
    },
  ],
}

export default injectionTable
