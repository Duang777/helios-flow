export const metadata = {
  requireAuth: true,
  requireFeatures: ['projects.manage'],
  pageTitle: 'Edit project',
  pageTitleKey: 'projects.edit.title',
  pageGroup: 'Projects',
  pageGroupKey: 'projects.nav.group',
  icon: 'folder-kanban',
  breadcrumb: [
    { label: 'Projects', labelKey: 'projects.page.title', href: '/backend/projects' },
    { label: 'Edit', labelKey: 'projects.edit.title' },
  ],
}
