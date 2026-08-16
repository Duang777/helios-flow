export const metadata = {
  requireAuth: true,
  requireFeatures: ['projects.manage'],
  pageTitle: 'Create risk',
  pageTitleKey: 'projects.risks.create.title',
  pageGroup: 'Projects',
  pageGroupKey: 'projects.nav.group',
  icon: 'shield-alert',
  breadcrumb: [
    { label: 'Risks', labelKey: 'projects.risks.page.title', href: '/backend/risks' },
    { label: 'Create', labelKey: 'projects.risks.create.title' },
  ],
}
