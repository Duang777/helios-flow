export const metadata = {
  requireAuth: true,
  requireFeatures: ['projects.manage'],
  pageTitle: 'Create milestone',
  pageTitleKey: 'projects.milestones.create.title',
  pageGroup: 'Projects',
  pageGroupKey: 'projects.nav.group',
  icon: 'flag',
  breadcrumb: [
    { label: 'Milestones', labelKey: 'projects.milestones.page.title', href: '/backend/milestones' },
    { label: 'Create', labelKey: 'projects.milestones.create.title' },
  ],
}
