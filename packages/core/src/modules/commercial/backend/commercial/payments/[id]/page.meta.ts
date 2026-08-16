export const metadata = {
  requireAuth: true,
  requireFeatures: ['commercial.manage'],
  pageTitle: 'Edit payment',
  pageTitleKey: 'commercial.payments.edit.title',
  pageGroup: 'Commercial settlement',
  pageGroupKey: 'commercial.nav.group',
  icon: 'banknote',
  breadcrumb: [
    { label: 'payments', labelKey: 'commercial.payments.page.title', href: '/backend/commercial/payments' },
    { label: 'Edit', labelKey: 'commercial.payments.edit.title' },
  ],
}
