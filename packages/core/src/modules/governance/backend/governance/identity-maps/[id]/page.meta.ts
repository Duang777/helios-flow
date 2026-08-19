export const metadata = {
  requireAuth: true,
  requireFeatures: ['governance.view'],
  pageTitle: 'Edit identity map',
  pageTitleKey: 'governance.identityMaps.edit.title',
  pageGroup: 'Business analytics',
  pageGroupKey: 'governance.nav.group',
  breadcrumb: [
    { label: 'identity-maps', labelKey: 'governance.identityMaps.page.title', href: '/backend/governance/identity-maps' },
    { label: 'edit', labelKey: 'governance.identityMaps.edit.title' },
  ],
}
