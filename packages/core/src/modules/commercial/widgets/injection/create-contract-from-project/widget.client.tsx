'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import { Button } from '@helios/ui/primitives/button'
import { useT } from '@helios/shared/lib/i18n/context'
import { buildCreateContractHrefFromProject } from './create-contract-href'

export { buildCreateContractHrefFromProject }

type ProjectInjectionData = {
  project?: {
    id?: string
    name?: string | null
    customerEntityId?: string | null
    dealId?: string | null
  }
}

type HostInjectionContext = {
  projectId?: string
  recordId?: string
  data?: ProjectInjectionData
}

export default function CreateContractFromProjectWidget({
  context,
  data,
}: {
  context?: HostInjectionContext
  data?: ProjectInjectionData
}) {
  const t = useT()
  const router = useRouter()
  const href = React.useMemo(
    () => buildCreateContractHrefFromProject(context, data ?? context?.data),
    [context, data],
  )

  if (!href) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => router.push(href)}
      data-commercial-create-from-project=""
    >
      <FileText className="size-4" />
      <span>{t('commercial.action.createFromProject')}</span>
    </Button>
  )
}
