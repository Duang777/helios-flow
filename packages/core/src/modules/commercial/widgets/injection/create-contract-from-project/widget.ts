import type { InjectionWidgetModule } from '@helios/shared/modules/widgets/injection'
import CreateContractFromProjectWidget from './widget.client'

const widget: InjectionWidgetModule<Record<string, unknown>, Record<string, unknown>> = {
  metadata: {
    id: 'commercial.injection.create-contract-from-project',
    title: 'Create contract from project',
    description:
      'Renders a Create contract button on the projects detail header that navigates to the commercial contract create form with project and customer IDs prefilled.',
    features: ['commercial.manage'],
    priority: 80,
    enabled: true,
  },
  Widget: CreateContractFromProjectWidget,
}

export default widget
