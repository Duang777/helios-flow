export const enterprisePackage = {
  id: 'enterprise',
  description: 'Optional enterprise overlays and modules for Helios.',
  modules: ['security', 'sso','record_locks'],
} as const

export default enterprisePackage
