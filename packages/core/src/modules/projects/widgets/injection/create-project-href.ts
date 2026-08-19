type LinkedEntity = { id?: string; label?: string }

type DealInjectionData = {
  deal?: { id?: string; title?: string | null }
  companies?: LinkedEntity[]
  people?: LinkedEntity[]
}

type DealHostContext = {
  dealId?: string
  recordId?: string
  data?: DealInjectionData
}

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

function firstLinkedId(items: LinkedEntity[] | undefined): string | null {
  if (!Array.isArray(items)) return null
  for (const item of items) {
    const id = readString(item?.id)
    if (id) return id
  }
  return null
}

export function buildCreateProjectHrefFromDeal(
  context: DealHostContext | undefined,
  data: DealInjectionData | undefined,
): string | null {
  const dealRecord = data?.deal ?? context?.data?.deal
  const dealId =
    readString(context?.dealId) ?? readString(context?.recordId) ?? readString(dealRecord?.id)
  if (!dealId) return null

  const companies = data?.companies ?? context?.data?.companies
  const people = data?.people ?? context?.data?.people
  const customerEntityId = firstLinkedId(companies) ?? firstLinkedId(people)

  const params = new URLSearchParams()
  params.set('dealId', dealId)
  if (customerEntityId) params.set('customerEntityId', customerEntityId)
  const title = readString(dealRecord?.title)
  if (title) params.set('name', title)

  return `/backend/projects/create?${params.toString()}`
}

export function buildCreateProjectHrefFromCompany(
  context: CompanyHostContext | undefined,
  data: CompanyInjectionData | undefined,
): string | null {
  const company = data?.company ?? context?.data?.company
  const customerEntityId =
    readString(context?.companyId) ??
    readString(context?.recordId) ??
    readString(company?.id)
  if (!customerEntityId) return null

  const params = new URLSearchParams()
  params.set('customerEntityId', customerEntityId)
  const name = readString(company?.displayName) ?? readString(company?.name)
  if (name) params.set('name', name)

  return `/backend/projects/create?${params.toString()}`
}
