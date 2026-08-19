export const metadata = {
  requireAuth: true,
  requireFeatures: ['projects.manage'],
  pageTitle: 'Edit milestone',
  pageTitleKey: 'projects.milestones.edit.title',
  pageGroup: 'Projects',
  pageGroupKey: 'projects.nav.group',
  icon: 'flag',
  breadcrumb: [
    { label: 'Milestones', labelKey: 'projects.milestones.page.title', href: '/backend/milestones' },
    { label: 'Edit', labelKey: 'projects.milestones.edit.title' },
  ],
}
