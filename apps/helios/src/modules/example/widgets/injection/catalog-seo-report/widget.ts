import type { InjectionWidgetModule } from '@helios/shared/modules/widgets/injection'
import CatalogSeoReportWidget from './widget.client'

const widget: InjectionWidgetModule = {
  metadata: {
    id: 'example.injection.catalog-seo-report',
    title: '目录 SEO 报告',
    description: '在商品列表中标记需要更新 SEO 的商品。',
    priority: 10,
    enabled: true,
  },
  Widget: CatalogSeoReportWidget,
}

export default widget
