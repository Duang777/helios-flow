export const metadata = {
  requireAuth: true,
  requireFeatures: ['projects.view'],
  pageTitle: 'Milestones',
  pageTitleKey: 'projects.milestones.page.title',
  pageGroup: 'Projects',
  pageGroupKey: 'projects.nav.group',
  pageOrder: 36,
  icon: 'flag',
  breadcrumb: [
    { label: 'Projects', labelKey: 'projects.page.title', href: '/backend/projects' },
    { label: 'Milestones', labelKey: 'projects.milestones.page.title' },
  ],
}
