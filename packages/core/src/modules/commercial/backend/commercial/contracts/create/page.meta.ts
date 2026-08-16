export const metadata = {
  requireAuth: true,
  requireFeatures: ['commercial.manage'],
  pageTitle: 'Create contract',
  pageTitleKey: 'commercial.contracts.create.title',
  pageGroup: 'Commercial settlement',
  pageGroupKey: 'commercial.nav.group',
  icon: 'file-text',
  breadcrumb: [
    { label: 'contracts', labelKey: 'commercial.contracts.page.title', href: '/backend/commercial/contracts' },
    { label: 'Create', labelKey: 'commercial.contracts.create.title' },
  ],
}
