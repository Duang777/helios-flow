import type { InjectionWidgetModule } from '@helios/shared/modules/widgets/injection'
import OperatingLoopTriggerWidget from './widget.client'

const widget: InjectionWidgetModule<Record<string, unknown>, Record<string, unknown>> = {
  metadata: {
    id: 'insights.injection.operating-loop-trigger',
    title: 'Operating Loop Assistant trigger',
    description:
      'Renders an Operating Loop Assistant button on CRM, sales, catalog, and M5-M7 list/detail headers with record-aware page context.',
    features: ['ai_assistant.view'],
    requiredModules: ['ai_assistant', 'projects', 'commercial', 'insights', 'governance'],
    priority: 60,
    enabled: true,
  },
  Widget: OperatingLoopTriggerWidget,
}

export default widget
