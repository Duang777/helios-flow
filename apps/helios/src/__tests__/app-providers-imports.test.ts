import fs from 'node:fs'
import path from 'node:path'

describe('AppProviders import graph', () => {
  it('uses direct UI imports instead of the broad package barrel', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/components/AppProviders.tsx'), 'utf8')

    expect(source).not.toContain("from '@helios/ui'")
    expect(source).toContain("@helios/ui/theme/ThemeProvider")
    expect(source).toContain("@helios/ui/theme/QueryProvider")
    expect(source).toContain("@helios/ui/frontend/Layout")
    expect(source).toContain("@helios/ui/frontend/AuthFooter")
  })
})
