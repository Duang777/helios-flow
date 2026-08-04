import type { ModuleInjectionTable } from '@helios/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'profile:communication-channels:connect': [
    {
      widgetId: 'channel_imap.injection.connect',
      priority: 100,
    },
  ],
}

export default injectionTable
