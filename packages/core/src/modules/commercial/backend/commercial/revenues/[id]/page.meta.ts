export const metadata = {
  requireAuth: true,
  requireFeatures: ['commercial.manage'],
  pageTitle: 'Edit revenue',
  pageTitleKey: 'commercial.revenues.edit.title',
  pageGroup: 'Commercial settlement',
  pageGroupKey: 'commercial.nav.group',
  icon: 'trending-up',
  breadcrumb: [
    { label: 'revenues', labelKey: 'commercial.revenues.page.title', href: '/backend/commercial/revenues' },
    { label: 'Edit', labelKey: 'commercial.revenues.edit.title' },
  ],
}
