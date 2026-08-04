import { createLogger } from '@helios/shared/lib/logger'

const logger = createLogger('system_status_overlays')

const APP_BOOTSTRAP_EVENT = 'application.bootstrap.completed'
const ENTERPRISE_WARNING_GLOBAL_KEY = '__heliosEnterpriseLicenseWarningShown__'

export const metadata = {
  event: APP_BOOTSTRAP_EVENT,
  persistent: false,
  id: 'system_status_overlays:application-bootstrap-enterprise-warning',
}

export default async function handle() {
  if ((globalThis as Record<string, unknown>)[ENTERPRISE_WARNING_GLOBAL_KEY] === true) return

  ;(globalThis as Record<string, unknown>)[ENTERPRISE_WARNING_GLOBAL_KEY] = true
  logger.warn(
    'Enterprise modules are enabled. Developer preview is free, but production usage requires a commercial enterprise license. See: https://github.com/helios/helios/blob/main/packages/enterprise/README.md',
  )
}
