'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { FolderKanban } from 'lucide-react'
import { Button } from '@helios/ui/primitives/button'
import { useT } from '@helios/shared/lib/i18n/context'
import { buildCreateProjectHrefFromCompany } from '../create-project-href'

export { buildCreateProjectHrefFromCompany }

type CompanyInjectionData = {
  company?: { id?: string; displayName?: string | null; name?: string | null }
}

type HostInjectionContext = {
  companyId?: string
  recordId?: string
  data?: CompanyInjectionData
}

export default function CreateProjectFromCompanyWidget({
  context,
  data,
}: {
  context?: HostInjectionContext
  data?: CompanyInjectionData
}) {
  const t = useT()
  const router = useRouter()
  const href = React.useMemo(
    () => buildCreateProjectHrefFromCompany(context, data ?? context?.data),
    [context, data],
  )

  if (!href) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => router.push(href)}
      data-projects-create-from-company=""
    >
      <FolderKanban className="size-4" />
      <span>{t('projects.action.createFromCompany')}</span>
    </Button>
  )
}
