import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runRailwayDeploy } from '../index'

describe('helios deploy railway --dry-run', () => {
  it('prints a deterministic local-source plan without a token or state mutation', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'helios-railway-dry-run-'))
    mkdirSync(join(cwd, 'node_modules'), { recursive: true })
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({
      name: 'My Shop',
      dependencies: { '@helios/core': '0.6.4' },
    }))
    writeFileSync(join(cwd, '.env'), 'CUSTHELIOS_SETTING=enabled\n')
    writeFileSync(
      join(cwd, '.railwayignore'),
      '.env*\n*.pem\n*.key\nid_*\n.git\n.railway\nnode_modules\n.yarn/cache\n.next\n.turbo\n*.db\n*.sqlite\n*.sqlite3\n.helios/railway.json*\n',
    )
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)

    await runRailwayDeploy(['--dry-run', '--source', 'local'], {
      cwd,
      resolveSource: () => ({ mode: 'local', reason: 'test local source' }),
    })

    const output = log.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(output).toContain('Railway deployment plan (dry run)')
    expect(output).toContain('Project: my-shop')
    expect(output).toContain('Source: local')
    expect(output).toContain('AUTH_SECRET=<redacted>')
    expect(output).not.toContain('generated-at-deploy')
    log.mockRestore()
  })

  it('prints a cleanup plan without deleting tracked state', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'helios-railway-cleanup-dry-run-'))
    mkdirSync(join(cwd, '.helios'), { recursive: true })
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({
      name: 'My Shop',
      dependencies: { '@helios/core': '0.6.4' },
    }))
    const statePath = join(cwd, '.helios', 'railway.json')
    writeFileSync(statePath, JSON.stringify({
      schemaVersion: 1,
      provider: 'railway',
      projectId: 'project-1',
      projectName: 'my-shop',
      environments: {},
      writtenBy: { cliVersion: 'test' },
    }))
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)

    await runRailwayDeploy(['--cleanup', '--dry-run'], { cwd })

    const output = log.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(output).toContain('Railway cleanup plan (dry run)')
    expect(output).toContain('projectDelete')
    expect(existsSync(statePath)).toBe(true)
    log.mockRestore()
  })
})
