import type { InjectionWidgetModule } from '@helios/shared/modules/widgets/injection'
import CreateProjectFromCompanyWidget from './widget.client'

const widget: InjectionWidgetModule<Record<string, unknown>, Record<string, unknown>> = {
  metadata: {
    id: 'projects.injection.create-project-from-company',
    title: 'Create project from company',
    description:
      'Renders a Create project button on the customers company detail header that navigates to the projects create form with customerEntityId prefilled.',
    features: ['projects.manage'],
    priority: 80,
    enabled: true,
  },
  Widget: CreateProjectFromCompanyWidget,
}

export default widget
