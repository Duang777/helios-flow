export const metadata = {
  requireAuth: true,
  requireFeatures: ['commercial.manage'],
  pageTitle: 'Create cost',
  pageTitleKey: 'commercial.costs.create.title',
  pageGroup: 'Commercial settlement',
  pageGroupKey: 'commercial.nav.group',
  icon: 'wallet',
  breadcrumb: [
    { label: 'costs', labelKey: 'commercial.costs.page.title', href: '/backend/commercial/costs' },
    { label: 'Create', labelKey: 'commercial.costs.create.title' },
  ],
}
