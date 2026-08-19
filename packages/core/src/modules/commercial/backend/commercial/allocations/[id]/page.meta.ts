export const metadata = {
  requireAuth: true,
  requireFeatures: ['commercial.manage'],
  pageTitle: 'Edit allocation',
  pageTitleKey: 'commercial.allocations.edit.title',
  pageGroup: 'Commercial settlement',
  pageGroupKey: 'commercial.nav.group',
  icon: 'link',
  breadcrumb: [
    { label: 'allocations', labelKey: 'commercial.allocations.page.title', href: '/backend/commercial/allocations' },
    { label: 'Edit', labelKey: 'commercial.allocations.edit.title' },
  ],
}
