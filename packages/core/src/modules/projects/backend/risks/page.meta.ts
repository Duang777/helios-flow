export const metadata = {
  requireAuth: true,
  requireFeatures: ['projects.view'],
  pageTitle: 'Project risks',
  pageTitleKey: 'projects.risks.page.title',
  pageGroup: 'Projects',
  pageGroupKey: 'projects.nav.group',
  pageOrder: 37,
  icon: 'shield-alert',
  breadcrumb: [
    { label: 'Projects', labelKey: 'projects.page.title', href: '/backend/projects' },
    { label: 'Risks', labelKey: 'projects.risks.page.title' },
  ],
}
