import type { ModuleEncryptionMap } from '@helios/shared/modules/encryption'

export const defaultEncryptionMaps: ModuleEncryptionMap[] = [
  {
    entityId: 'integrations:integration_credentials',
    fields: [{ field: 'credentials' }],
  },
]

export default defaultEncryptionMaps
