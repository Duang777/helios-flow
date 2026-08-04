import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { PackageResolver } from '../resolver'
import { addOfficialModule, enableOfficialModule } from '../module-install'

function buildPackageFixture(
  packageRoot: string,
  moduleId: string,
  options?: {
    ejectable?: boolean
    extraSourceFiles?: Array<{ relativePath: string; content: string }>
    packageName?: string
  },
): void {
  const ejectable = options?.ejectable ?? false
  const packageName = options?.packageName ?? '@helios/test-package'
  for (const base of ['src', 'dist']) {
    fs.mkdirSync(path.join(packageRoot, base, 'modules', moduleId), { recursive: true })
  }
  fs.writeFileSync(
    path.join(packageRoot, 'package.json'),
    JSON.stringify({ name: packageName, version: '0.1.0' }),
  )
  fs.writeFileSync(
    path.join(packageRoot, 'src', 'modules', moduleId, 'index.ts'),
    `export const metadata = { title: 'Test', ejectable: ${ejectable ? 'true' : 'false'} }\n`,
  )
  fs.writeFileSync(
    path.join(packageRoot, 'dist', 'modules', moduleId, 'index.js'),
    `exports.metadata = {};\n`,
  )

  for (const file of options?.extraSourceFiles ?? []) {
    const targetPath = path.join(packageRoot, 'src', 'modules', moduleId, file.relativePath)
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.writeFileSync(targetPath, file.content)
  }
}

function buildResolver(
  appDir: string,
  packageRoot: string,
  modulesTsContent: string,
): PackageResolver {
  const modulesTsPath = path.join(appDir, 'src', 'modules.ts')
  fs.mkdirSync(path.join(appDir, 'src'), { recursive: true })
  fs.writeFileSync(modulesTsPath, modulesTsContent)

  return {
    getAppDir: () => appDir,
    getModulesConfigPath: () => modulesTsPath,
    getPackageRoot: () => packageRoot,
    isMonorepo: () => false,
    getRootDir: () => appDir,
    loadEnabledModules: () => [],
    getModulePaths: () => ({ appBase: '', pkgBase: '' }),
    getOutputDir: () => path.join(appDir, '.helios', 'generated'),
  } as unknown as PackageResolver
}

describe('enableOfficialModule', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'module-install-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('throws when module is already enabled in modules.ts with the same source', async () => {
    const packageRoot = path.join(tmpDir, 'node_modules', '@helios', 'test-package')
    const appDir = path.join(tmpDir, 'app')
    buildPackageFixture(packageRoot, 'test_package')

    const resolver = buildResolver(
      appDir,
      packageRoot,
      "export const enabledModules = [{ id: 'test_package', from: '@helios/test-package' }]\n",
    )

    await expect(
      enableOfficialModule(resolver, '@helios/test-package'),
    ).rejects.toThrow('already enabled in modules.ts')
  })

  it('throws when module is already enabled with different casing in the source field', async () => {
    const packageRoot = path.join(tmpDir, 'node_modules', '@helios', 'test-package')
    const appDir = path.join(tmpDir, 'app')
    buildPackageFixture(packageRoot, 'test_package')

    // registered without explicit from (defaults to @helios/core internally) — different from what enable would write
    // This triggers the "already registered from different source" error from ensureModuleRegistration
    const resolver = buildResolver(
      appDir,
      packageRoot,
      "export const enabledModules = [{ id: 'test_package', from: '@helios/other' }]\n",
    )

    await expect(
      enableOfficialModule(resolver, '@helios/test-package'),
    ).rejects.toThrow('already registered from')
  })

  it('error message includes the module id and package name', async () => {
    const packageRoot = path.join(tmpDir, 'node_modules', '@helios', 'test-package')
    const appDir = path.join(tmpDir, 'app')
    buildPackageFixture(packageRoot, 'test_package')

    const resolver = buildResolver(
      appDir,
      packageRoot,
      "export const enabledModules = [{ id: 'test_package', from: '@helios/test-package' }]\n",
    )

    await expect(
      enableOfficialModule(resolver, '@helios/test-package'),
    ).rejects.toThrow('"test_package"')

    await expect(
      enableOfficialModule(resolver, '@helios/test-package'),
    ).rejects.toThrow('"@helios/test-package"')
  })

  it('throws when the specific module is already enabled in a multi-module package', async () => {
    const packageRoot = path.join(tmpDir, 'node_modules', '@helios', 'multi')
    const appDir = path.join(tmpDir, 'app')

    // package with two modules
    for (const moduleId of ['alpha', 'beta']) {
      fs.mkdirSync(path.join(packageRoot, 'src', 'modules', moduleId), { recursive: true })
      fs.mkdirSync(path.join(packageRoot, 'dist', 'modules', moduleId), { recursive: true })
      fs.writeFileSync(
        path.join(packageRoot, 'src', 'modules', moduleId, 'index.ts'),
        `export const metadata = { ejectable: false }\n`,
      )
      fs.writeFileSync(
        path.join(packageRoot, 'dist', 'modules', moduleId, 'index.js'),
        `exports.metadata = {};\n`,
      )
    }
    fs.writeFileSync(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({ name: '@helios/multi', version: '0.1.0' }),
    )

    // alpha is already enabled, beta is not
    const resolver = buildResolver(
      appDir,
      packageRoot,
      "export const enabledModules = [{ id: 'alpha', from: '@helios/multi' }]\n",
    )

    await expect(
      enableOfficialModule(resolver, '@helios/multi', 'alpha'),
    ).rejects.toThrow('already enabled in modules.ts')

    // beta is not yet enabled — must not throw "already enabled", even if generators fail afterwards
    try {
      await enableOfficialModule(resolver, '@helios/multi', 'beta')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      expect(message).not.toContain('already enabled in modules.ts')
    }
  })

  it('copies module source into the app when enabling with --eject', async () => {
    const packageRoot = path.join(tmpDir, 'node_modules', '@helios', 'test-package')
    const appDir = path.join(tmpDir, 'app')
    buildPackageFixture(packageRoot, 'test_package', {
      ejectable: true,
      extraSourceFiles: [
        {
          relativePath: path.join('backend', 'page.tsx'),
          content: 'export default function TestPage() { return null }\n',
        },
      ],
    })

    const resolver = buildResolver(
      appDir,
      packageRoot,
      "export const enabledModules = []\n",
    )

    await expect(
      enableOfficialModule(
        resolver,
        '@helios/test-package',
        undefined,
        true,
      ),
    ).resolves.toEqual({
      moduleId: 'test_package',
      packageName: '@helios/test-package',
      from: '@app',
      registrationChanged: true,
    })

    expect(fs.existsSync(path.join(appDir, 'src', 'modules', 'test_package', 'index.ts'))).toBe(true)
    expect(fs.existsSync(path.join(appDir, 'src', 'modules', 'test_package', 'backend', 'page.tsx'))).toBe(true)
    expect(fs.readFileSync(path.join(appDir, 'src', 'modules.ts'), 'utf8')).toContain(
      "{ id: 'test_package', from: '@app' }",
    )
  })

  it('rejects enabling with --eject when the package is not ejectable', async () => {
    const packageRoot = path.join(tmpDir, 'node_modules', '@helios', 'test-package')
    const appDir = path.join(tmpDir, 'app')
    buildPackageFixture(packageRoot, 'test_package')

    const resolver = buildResolver(
      appDir,
      packageRoot,
      "export const enabledModules = []\n",
    )

    await expect(
      enableOfficialModule(resolver, '@helios/test-package', undefined, true),
    ).rejects.toThrow('--eject requires helios.ejectable === true')
  })

  it('rejects unsupported package specs before invoking the package manager', async () => {
    const packageRoot = path.join(tmpDir, 'node_modules', '@helios', 'test-package')
    const appDir = path.join(tmpDir, 'app')
    buildPackageFixture(packageRoot, 'test_package')

    const resolver = buildResolver(
      appDir,
      packageRoot,
      "export const enabledModules = []\n",
    )

    await expect(
      addOfficialModule(resolver, '@helios/test-package@npm:evil', false),
    ).rejects.toThrow('Unsupported package spec suffix')
  })
})

describe('third-party module packages', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'module-install-3p-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('rejects adding a non-@helios package without --allow-third-party', async () => {
    const packageRoot = path.join(tmpDir, 'node_modules', '@fast-white-cat', 'integration-ksef-direct')
    const appDir = path.join(tmpDir, 'app')
    buildPackageFixture(packageRoot, 'ksef_direct', {
      packageName: '@fast-white-cat/integration-ksef-direct',
    })

    const resolver = buildResolver(appDir, packageRoot, 'export const enabledModules = []\n')

    await expect(
      addOfficialModule(resolver, '@fast-white-cat/integration-ksef-direct@0.1.0', false),
    ).rejects.toThrow('Re-run with --allow-third-party')
  })

  it('rejects enabling a non-@helios package without --allow-third-party', async () => {
    const packageRoot = path.join(tmpDir, 'node_modules', '@fast-white-cat', 'integration-ksef-direct')
    const appDir = path.join(tmpDir, 'app')
    buildPackageFixture(packageRoot, 'ksef_direct', {
      packageName: '@fast-white-cat/integration-ksef-direct',
    })

    const resolver = buildResolver(appDir, packageRoot, 'export const enabledModules = []\n')

    await expect(
      enableOfficialModule(resolver, '@fast-white-cat/integration-ksef-direct'),
    ).rejects.toThrow('Re-run with --allow-third-party')
  })

  it('enables a non-@helios package when --allow-third-party is set', async () => {
    const packageRoot = path.join(tmpDir, 'node_modules', '@fast-white-cat', 'integration-ksef-direct')
    const appDir = path.join(tmpDir, 'app')
    buildPackageFixture(packageRoot, 'ksef_direct', {
      packageName: '@fast-white-cat/integration-ksef-direct',
    })

    const resolver = buildResolver(appDir, packageRoot, 'export const enabledModules = []\n')

    await expect(
      enableOfficialModule(resolver, '@fast-white-cat/integration-ksef-direct', undefined, false, true),
    ).resolves.toEqual({
      moduleId: 'ksef_direct',
      packageName: '@fast-white-cat/integration-ksef-direct',
      from: '@fast-white-cat/integration-ksef-direct',
      registrationChanged: true,
    })

    expect(fs.readFileSync(path.join(appDir, 'src', 'modules.ts'), 'utf8')).toContain(
      "{ id: 'ksef_direct', from: '@fast-white-cat/integration-ksef-direct' }",
    )
  })
})
