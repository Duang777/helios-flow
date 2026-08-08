export const metadata = {
  requireAuth: true,
  requireFeatures: ['commercial.manage'],
  pageTitle: 'Edit invoice',
  pageTitleKey: 'commercial.invoices.edit.title',
  pageGroup: 'Commercial settlement',
  pageGroupKey: 'commercial.nav.group',
  icon: 'receipt',
  breadcrumb: [
    { label: 'invoices', labelKey: 'commercial.invoices.page.title', href: '/backend/commercial/invoices' },
    { label: 'Edit', labelKey: 'commercial.invoices.edit.title' },
  ],
}
