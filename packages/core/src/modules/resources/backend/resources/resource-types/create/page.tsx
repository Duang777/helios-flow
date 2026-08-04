"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@helios/ui/backend/Page'
import { createCrud } from '@helios/ui/backend/utils/crud'
import { flash } from '@helios/ui/backend/FlashMessages'
import { buildResourceTypePayload, ResourceTypeCrudForm, type ResourceTypeFormValues } from '@helios/core/modules/resources/components/ResourceTypeCrudForm'
import { useT } from '@helios/shared/lib/i18n/context'

export default function ResourcesResourceTypeCreatePage() {
  const t = useT()
  const router = useRouter()

  const handleSubmit = React.useCallback(async (values: ResourceTypeFormValues) => {
    const payload = buildResourceTypePayload(values)
    await createCrud('resources/resource-types', payload, {
      errorMessage: t('resources.resourceTypes.errors.save', 'Failed to save resource type.'),
    })
    flash(t('resources.resourceTypes.messages.saved', 'Resource type saved.'), 'success')
    router.push('/backend/resources/resource-types')
  }, [router, t])

  return (
    <Page>
      <PageBody>
        <ResourceTypeCrudForm
          mode="create"
          initialValues={{ name: '', description: '', appearance: { icon: null, color: null } }}
          onSubmit={handleSubmit}
        />
      </PageBody>
    </Page>
  )
}
