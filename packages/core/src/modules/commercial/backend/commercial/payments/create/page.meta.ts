export const metadata = {
  requireAuth: true,
  requireFeatures: ['commercial.manage'],
  pageTitle: 'Create payment',
  pageTitleKey: 'commercial.payments.create.title',
  pageGroup: 'Commercial settlement',
  pageGroupKey: 'commercial.nav.group',
  icon: 'banknote',
  breadcrumb: [
    { label: 'payments', labelKey: 'commercial.payments.page.title', href: '/backend/commercial/payments' },
    { label: 'Create', labelKey: 'commercial.payments.create.title' },
  ],
}
