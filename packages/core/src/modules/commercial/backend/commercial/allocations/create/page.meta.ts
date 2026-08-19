export const metadata = {
  requireAuth: true,
  requireFeatures: ['commercial.manage'],
  pageTitle: 'Create allocation',
  pageTitleKey: 'commercial.allocations.create.title',
  pageGroup: 'Commercial settlement',
  pageGroupKey: 'commercial.nav.group',
  icon: 'link',
  breadcrumb: [
    { label: 'allocations', labelKey: 'commercial.allocations.page.title', href: '/backend/commercial/allocations' },
    { label: 'Create', labelKey: 'commercial.allocations.create.title' },
  ],
}
