"use client"

import type { ReactNode } from 'react'
import type { Locale } from '@helios/shared/lib/i18n/config'
import type { Dict } from '@helios/shared/lib/i18n/context'
import { I18nProvider } from '@helios/shared/lib/i18n/context'
import { ThemeProvider } from '@helios/ui/theme/ThemeProvider'
import { QueryProvider } from '@helios/ui/theme/QueryProvider'
import { FrontendLayout } from '@helios/ui/frontend/Layout'
import { AuthFooter } from '@helios/ui/frontend/AuthFooter'
import { ClientBootstrapProvider } from '@/components/ClientBootstrap'
import { GlobalNoticeBars } from '@/components/GlobalNoticeBars'
import { ComponentOverridesBootstrap } from '@/components/ComponentOverridesBootstrap'

type AppProvidersProps = {
  children: ReactNode
  locale: Locale
  dict: Dict
  localeLocked: boolean
  demoModeEnabled: boolean
  noticeBarsEnabled: boolean
}

export function AppProviders({ children, locale, dict, localeLocked, demoModeEnabled, noticeBarsEnabled }: AppProvidersProps) {
  return (
    <I18nProvider locale={locale} dict={dict} localeLocked={localeLocked}>
      <ClientBootstrapProvider>
        <ComponentOverridesBootstrap>
          <ThemeProvider>
            <QueryProvider>
              <FrontendLayout footer={<AuthFooter />}>{children}</FrontendLayout>
              {noticeBarsEnabled ? <GlobalNoticeBars demoModeEnabled={demoModeEnabled} /> : null}
            </QueryProvider>
          </ThemeProvider>
        </ComponentOverridesBootstrap>
      </ClientBootstrapProvider>
    </I18nProvider>
  )
}
