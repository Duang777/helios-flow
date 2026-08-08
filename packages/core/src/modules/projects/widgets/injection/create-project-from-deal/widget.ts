import type { InjectionWidgetModule } from '@helios/shared/modules/widgets/injection'
import CreateProjectFromDealWidget from './widget.client'

const widget: InjectionWidgetModule<Record<string, unknown>, Record<string, unknown>> = {
  metadata: {
    id: 'projects.injection.create-project-from-deal',
    title: 'Create project from deal',
    description:
      'Renders a Create project button on the customers deal detail header that navigates to the projects create form with deal and customer entity IDs prefilled.',
    features: ['projects.manage'],
    priority: 80,
    enabled: true,
  },
  Widget: CreateProjectFromDealWidget,
}

export default widget
