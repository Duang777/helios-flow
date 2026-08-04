import type { ModuleSetupConfig } from '@helios/shared/modules/setup'
import { seedDashboardDefaultsForTenant } from '@helios/core/modules/dashboards/cli'
import { appendWidgetsToRoles, resolveAnalyticsWidgetIds } from '@helios/core/modules/dashboards/lib/role-widgets'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['dashboards.*', 'dashboards.admin.assign-widgets', 'analytics.view'],
    employee: ['dashboards.view', 'dashboards.configure', 'analytics.view'],
  },

  async onTenantCreated({ em, tenantId, organizationId }) {
    await seedDashboardDefaultsForTenant(em, { tenantId, organizationId, logger: () => {} })
  },

  async seedDefaults({ em, tenantId, organizationId }) {
    const analyticsWidgetIds = await resolveAnalyticsWidgetIds()
    await appendWidgetsToRoles(em, {
      tenantId,
      organizationId,
      roleNames: ['admin', 'employee'],
      widgetIds: analyticsWidgetIds,
    })
  },
}

export default setup
