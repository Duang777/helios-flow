export const metadata = {
  requireAuth: true,
  requireFeatures: ['projects.manage'],
  pageTitle: 'Edit risk',
  pageTitleKey: 'projects.risks.edit.title',
  pageGroup: 'Projects',
  pageGroupKey: 'projects.nav.group',
  icon: 'shield-alert',
  breadcrumb: [
    { label: 'Risks', labelKey: 'projects.risks.page.title', href: '/backend/risks' },
    { label: 'Edit', labelKey: 'projects.risks.edit.title' },
  ],
}
