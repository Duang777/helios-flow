export const metadata = {
  requireAuth: true,
  requireFeatures: ['commercial.manage'],
  pageTitle: 'Edit contract',
  pageTitleKey: 'commercial.contracts.edit.title',
  pageGroup: 'Commercial settlement',
  pageGroupKey: 'commercial.nav.group',
  icon: 'file-text',
  breadcrumb: [
    { label: 'contracts', labelKey: 'commercial.contracts.page.title', href: '/backend/commercial/contracts' },
    { label: 'Edit', labelKey: 'commercial.contracts.edit.title' },
  ],
}
