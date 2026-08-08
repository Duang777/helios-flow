export const metadata = {
  requireAuth: true,
  requireFeatures: ['governance.view'],
  pageTitle: 'Finding detail',
  pageTitleKey: 'governance.findings.detail.title',
  pageGroup: 'Business analytics',
  pageGroupKey: 'governance.nav.group',
  breadcrumb: [
    { label: 'findings', labelKey: 'governance.findings.page.title', href: '/backend/governance/findings' },
    { label: 'detail', labelKey: 'governance.findings.detail.title' },
  ],
}
