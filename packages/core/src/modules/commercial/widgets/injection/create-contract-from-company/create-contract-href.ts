type CompanyInjectionData = {
  company?: { id?: string; displayName?: string | null; name?: string | null }
}

type CompanyHostContext = {
  companyId?: string
  recordId?: string
  data?: CompanyInjectionData
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function buildCreateContractHrefFromCompany(
  context: CompanyHostContext | undefined,
  data: CompanyInjectionData | undefined,
): string | null {
  const company = data?.company ?? context?.data?.company
  const customerEntityId =
    readString(context?.companyId) ?? readString(context?.recordId) ?? readString(company?.id)
  if (!customerEntityId) return null

  const params = new URLSearchParams()
  params.set('customerEntityId', customerEntityId)
  return `/backend/commercial/contracts/create?${params.toString()}`
}
