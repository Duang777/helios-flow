export const metadata = {
  requireAuth: true,
  requireFeatures: ['commercial.manage'],
  pageTitle: 'Edit cost',
  pageTitleKey: 'commercial.costs.edit.title',
  pageGroup: 'Commercial settlement',
  pageGroupKey: 'commercial.nav.group',
  icon: 'wallet',
  breadcrumb: [
    { label: 'costs', labelKey: 'commercial.costs.page.title', href: '/backend/commercial/costs' },
    { label: 'Edit', labelKey: 'commercial.costs.edit.title' },
  ],
}
