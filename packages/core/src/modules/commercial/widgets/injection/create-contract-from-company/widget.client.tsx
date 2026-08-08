'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import { Button } from '@helios/ui/primitives/button'
import { useT } from '@helios/shared/lib/i18n/context'
import { buildCreateContractHrefFromCompany } from './create-contract-href'

export { buildCreateContractHrefFromCompany }

type CompanyInjectionData = {
  company?: { id?: string; displayName?: string | null; name?: string | null }
}

type HostInjectionContext = {
  companyId?: string
  recordId?: string
  data?: CompanyInjectionData
}

export default function CreateContractFromCompanyWidget({
  context,
  data,
}: {
  context?: HostInjectionContext
  data?: CompanyInjectionData
}) {
  const t = useT()
  const router = useRouter()
  const href = React.useMemo(
    () => buildCreateContractHrefFromCompany(context, data ?? context?.data),
    [context, data],
  )

  if (!href) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => router.push(href)}
      data-commercial-create-from-company=""
    >
      <FileText className="size-4" />
      <span>{t('commercial.action.createFromCompany')}</span>
    </Button>
  )
}
