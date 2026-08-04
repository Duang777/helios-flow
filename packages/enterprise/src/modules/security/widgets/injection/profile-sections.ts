import type { InjectionWidgetModule } from '@helios/shared/modules/widgets/injection'

const widgetModule: InjectionWidgetModule = {
  metadata: {
    id: 'security.injection.profile-sections',
    title: 'Security profile sections',
    priority: 500,
    enabled: true,
  },
  Widget: () => null,
}

export default widgetModule
