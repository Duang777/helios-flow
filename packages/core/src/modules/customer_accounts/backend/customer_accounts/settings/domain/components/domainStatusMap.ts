import type { StatusMap } from '@helios/ui/primitives/status-badge'
import type { DomainStatus } from '@helios/core/modules/customer_accounts/data/entities'

export const domainStatusMap: StatusMap<DomainStatus> = {
  pending: 'info',
  verified: 'info',
  active: 'success',
  dns_failed: 'error',
  tls_failed: 'warning',
}
