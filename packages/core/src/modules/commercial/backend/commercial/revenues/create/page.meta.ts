export const metadata = {
  requireAuth: true,
  requireFeatures: ['commercial.manage'],
  pageTitle: 'Create revenue',
  pageTitleKey: 'commercial.revenues.create.title',
  pageGroup: 'Commercial settlement',
  pageGroupKey: 'commercial.nav.group',
  icon: 'trending-up',
  breadcrumb: [
    { label: 'revenues', labelKey: 'commercial.revenues.page.title', href: '/backend/commercial/revenues' },
    { label: 'Create', labelKey: 'commercial.revenues.create.title' },
  ],
}
