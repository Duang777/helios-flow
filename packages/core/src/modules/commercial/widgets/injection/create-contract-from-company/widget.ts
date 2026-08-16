import type { InjectionWidgetModule } from '@helios/shared/modules/widgets/injection'
import CreateContractFromCompanyWidget from './widget.client'

const widget: InjectionWidgetModule<Record<string, unknown>, Record<string, unknown>> = {
  metadata: {
    id: 'commercial.injection.create-contract-from-company',
    title: 'Create contract from company',
    description:
      'Renders a Create contract button on the customers company detail header that navigates to the commercial contract create form with customer entity ID prefilled.',
    features: ['commercial.manage'],
    priority: 70,
    enabled: true,
  },
  Widget: CreateContractFromCompanyWidget,
}

export default widget
