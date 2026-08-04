'use client'

import * as React from 'react'
import { componentOverrideEntries } from '@/.helios/generated/component-overrides.generated'
import { ComponentOverrideProvider } from '@helios/ui/backend/injection/ComponentOverrideProvider'

export function ComponentOverridesBootstrap({ children }: { children: React.ReactNode }) {
  const overrides = React.useMemo(
    () => componentOverrideEntries.flatMap((entry) => entry.componentOverrides ?? []),
    [],
  )

  return (
    <ComponentOverrideProvider overrides={overrides}>
      {children}
    </ComponentOverrideProvider>
  )
}

export default ComponentOverridesBootstrap
