import { parseModuleInstallArgs } from '../module-install-args'

describe('parseModuleInstallArgs', () => {
  it('defaults to package-backed install without ejecting source', () => {
    expect(parseModuleInstallArgs(['@helios/test-package'])).toMatchObject({
      packageSpec: '@helios/test-package',
      eject: false,
    })
  })

  it('accepts --eject as a boolean flag', () => {
    expect(parseModuleInstallArgs(['@helios/test-package', '--eject'])).toMatchObject({
      eject: true,
    })
    expect(parseModuleInstallArgs(['--eject', '@helios/test-package'])).toMatchObject({
      packageSpec: '@helios/test-package',
      eject: true,
    })
  })

  it('rejects --eject values', () => {
    expect(() => parseModuleInstallArgs(['@helios/test-package', '--eject=true'])).toThrow(
      '--eject does not accept a value',
    )
  })

  it('rejects unsupported options', () => {
    expect(() => parseModuleInstallArgs(['@helios/test-package', '--unknown'])).toThrow(
      'Unsupported option: --unknown',
    )
    expect(() => parseModuleInstallArgs(['@helios/test-package', '--installed'])).toThrow(
      'Unsupported option: --installed',
    )
  })

  it('defaults allowThirdParty to false', () => {
    expect(parseModuleInstallArgs(['@helios/test-package'])).toMatchObject({
      allowThirdParty: false,
    })
  })

  it('accepts --allow-third-party as a boolean flag', () => {
    expect(parseModuleInstallArgs(['@scope/pkg', '--allow-third-party'])).toMatchObject({
      packageSpec: '@scope/pkg',
      allowThirdParty: true,
    })
    expect(parseModuleInstallArgs(['--allow-third-party', '@scope/pkg'])).toMatchObject({
      packageSpec: '@scope/pkg',
      allowThirdParty: true,
    })
  })

  it('rejects --allow-third-party values', () => {
    expect(() => parseModuleInstallArgs(['@scope/pkg', '--allow-third-party=true'])).toThrow(
      '--allow-third-party does not accept a value',
    )
  })
})
