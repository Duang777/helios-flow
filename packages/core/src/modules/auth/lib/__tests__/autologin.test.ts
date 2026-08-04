import { resolveAutoLoginCredentials, isAutoLoginEnabled } from '@helios/core/modules/auth/lib/autologin'

describe('resolveAutoLoginCredentials', () => {
  it('returns null when credentials are unset (default: disabled)', () => {
    expect(resolveAutoLoginCredentials({})).toBeNull()
    expect(isAutoLoginEnabled({})).toBe(false)
  })

  it('returns null when only one of email/password is set', () => {
    expect(resolveAutoLoginCredentials({ HELIOS_AUTOLOGIN_EMAIL: 'a@b.com' })).toBeNull()
    expect(resolveAutoLoginCredentials({ HELIOS_AUTOLOGIN_PASSWORD: 'secret' })).toBeNull()
  })

  it('returns null when email is blank/whitespace', () => {
    expect(
      resolveAutoLoginCredentials({ HELIOS_AUTOLOGIN_EMAIL: '   ', HELIOS_AUTOLOGIN_PASSWORD: 'secret' }),
    ).toBeNull()
  })

  it('resolves email + password with tenant omitted', () => {
    const env = { HELIOS_AUTOLOGIN_EMAIL: ' a@b.com ', HELIOS_AUTOLOGIN_PASSWORD: 'secret' }
    expect(resolveAutoLoginCredentials(env)).toEqual({ email: 'a@b.com', password: 'secret', tenantId: null })
    expect(isAutoLoginEnabled(env)).toBe(true)
  })

  it('preserves the password verbatim (no trimming of surrounding spaces)', () => {
    const env = { HELIOS_AUTOLOGIN_EMAIL: 'a@b.com', HELIOS_AUTOLOGIN_PASSWORD: ' spaced ' }
    expect(resolveAutoLoginCredentials(env)?.password).toBe(' spaced ')
  })

  it('includes tenant when provided', () => {
    const env = {
      HELIOS_AUTOLOGIN_EMAIL: 'a@b.com',
      HELIOS_AUTOLOGIN_PASSWORD: 'secret',
      HELIOS_AUTOLOGIN_TENANT: ' tenant-1 ',
    }
    expect(resolveAutoLoginCredentials(env)).toEqual({
      email: 'a@b.com',
      password: 'secret',
      tenantId: 'tenant-1',
    })
  })
})
