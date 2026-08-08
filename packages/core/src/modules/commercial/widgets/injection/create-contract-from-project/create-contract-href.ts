type ProjectInjectionData = {
  project?: {
    id?: string
    name?: string | null
    customerEntityId?: string | null
    dealId?: string | null
  }
}

type ProjectHostContext = {
  projectId?: string
  recordId?: string
  data?: ProjectInjectionData
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function buildCreateContractHrefFromProject(
  context: ProjectHostContext | undefined,
  data: ProjectInjectionData | undefined,
): string | null {
  const project = data?.project ?? context?.data?.project
  const projectId =
    readString(context?.projectId) ?? readString(context?.recordId) ?? readString(project?.id)
  if (!projectId) return null

  const params = new URLSearchParams()
  params.set('projectId', projectId)
  const customerEntityId = readString(project?.customerEntityId)
  if (customerEntityId) params.set('customerEntityId', customerEntityId)
  const dealId = readString(project?.dealId)
  if (dealId) params.set('dealId', dealId)

  return `/backend/commercial/contracts/create?${params.toString()}`
}
