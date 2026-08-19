export const metadata = {
  requireAuth: true,
  requireFeatures: ['projects.manage'],
  pageTitle: 'Create project',
  pageTitleKey: 'projects.create.title',
  pageGroup: 'Projects',
  pageGroupKey: 'projects.nav.group',
  icon: 'folder-kanban',
  breadcrumb: [
    { label: 'Projects', labelKey: 'projects.page.title', href: '/backend/projects' },
    { label: 'Create', labelKey: 'projects.create.title' },
  ],
}
