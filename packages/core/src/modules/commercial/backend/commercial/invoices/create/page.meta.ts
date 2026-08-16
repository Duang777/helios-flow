export const metadata = {
  requireAuth: true,
  requireFeatures: ['commercial.manage'],
  pageTitle: 'Create invoice',
  pageTitleKey: 'commercial.invoices.create.title',
  pageGroup: 'Commercial settlement',
  pageGroupKey: 'commercial.nav.group',
  icon: 'receipt',
  breadcrumb: [
    { label: 'invoices', labelKey: 'commercial.invoices.page.title', href: '/backend/commercial/invoices' },
    { label: 'Create', labelKey: 'commercial.invoices.create.title' },
  ],
}
