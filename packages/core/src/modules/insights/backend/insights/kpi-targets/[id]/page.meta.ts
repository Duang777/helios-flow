export const metadata = {
  requireAuth: true,
  requireFeatures: ['insights.manage'],
  pageTitle: 'Edit KPI target',
  pageTitleKey: 'insights.kpiTargets.edit.title',
  pageGroup: 'Business analytics',
  pageGroupKey: 'insights.nav.group',
  breadcrumb: [
    { label: 'kpi-targets', labelKey: 'insights.kpiTargets.page.title', href: '/backend/insights/kpi-targets' },
    { label: 'edit', labelKey: 'insights.kpiTargets.edit.title' },
  ],
}
