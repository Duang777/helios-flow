'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { FolderKanban } from 'lucide-react'
import { Button } from '@helios/ui/primitives/button'
import { useT } from '@helios/shared/lib/i18n/context'
import { buildCreateProjectHrefFromDeal } from '../create-project-href'

export { buildCreateProjectHrefFromDeal }

type DealInjectionData = {
  deal?: { id?: string; title?: string | null }
  companies?: Array<{ id?: string; label?: string }>
  people?: Array<{ id?: string; label?: string }>
}

type HostInjectionContext = {
  dealId?: string
  recordId?: string
  data?: DealInjectionData
}

export default function CreateProjectFromDealWidget({
  context,
  data,
}: {
  context?: HostInjectionContext
  data?: DealInjectionData
}) {
  const t = useT()
  const router = useRouter()
  const href = React.useMemo(
    () => buildCreateProjectHrefFromDeal(context, data ?? context?.data),
    [context, data],
  )

  if (!href) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => router.push(href)}
      data-projects-create-from-deal=""
    >
      <FolderKanban className="size-4" />
      <span>{t('projects.action.createFromDeal')}</span>
    </Button>
  )
}
