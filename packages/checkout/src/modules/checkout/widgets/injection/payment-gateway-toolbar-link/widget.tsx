"use client"
import Link from 'next/link'
import { useT } from '@helios/shared/lib/i18n/context'
import { Button } from '@helios/ui/primitives/button'
import type { InjectionWidgetModule } from '@helios/shared/modules/widgets/injection'

function ToolbarLinkWidget() {
  const t = useT()

  return (
    <Button asChild variant="outline">
      <Link href="/backend/checkout/pay-links/create">{t('checkout.widgets.paymentGatewayToolbarLink.action')}</Link>
    </Button>
  )
}

const widget: InjectionWidgetModule = {
  metadata: {
    id: 'checkout.injection.payment-gateway-toolbar-link',
    title: 'Create payment link',
    description: 'Shortcut from payment-gateway transactions to checkout pay-link creation.',
    features: ['checkout.create'],
  },
  Widget: ToolbarLinkWidget,
}

export default widget
