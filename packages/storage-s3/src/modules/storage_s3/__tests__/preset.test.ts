import type { CredentialsService } from '@helios/core/modules/integrations/lib/credentials-service'
import type { IntegrationLogService } from '@helios/core/modules/integrations/lib/log-service'
import { applyS3EnvPreset, readS3EnvPreset } from '../lib/preset'

describe('storage_s3 preset', () => {
  it('returns null when no env vars are provided', () => {
    expect(readS3EnvPreset({})).toBeNull()
  })

  it('reads required credentials from env and applies optional fields', () => {
    const preset = readS3EnvPreset({
      HELIOS_INTEGRATION_STORAGE_S3_ACCESS_KEY_ID: 'AKIAEXAMPLE',
      HELIOS_INTEGRATION_STORAGE_S3_SECRET_ACCESS_KEY: 'secret',
      HELIOS_INTEGRATION_STORAGE_S3_REGION: 'eu-central-1',
      HELIOS_INTEGRATION_STORAGE_S3_BUCKET: 'helios-bucket',
      HELIOS_INTEGRATION_STORAGE_S3_SESSION_TOKEN: 'session',
      HELIOS_INTEGRATION_STORAGE_S3_ENDPOINT: 'https://example.com',
      HELIOS_INTEGRATION_STORAGE_S3_FORCE_PATH_STYLE: 'true',
      HELIOS_INTEGRATION_STORAGE_S3_FORCE_PRECONFIGURE: 'true',
    })

    expect(preset).not.toBeNull()
    expect(preset?.credentials).toEqual({
      authMode: 'access_keys',
      accessKeyId: 'AKIAEXAMPLE',
      secretAccessKey: 'secret',
      sessionToken: 'session',
      region: 'eu-central-1',
      bucket: 'helios-bucket',
      endpoint: 'https://example.com',
      forcePathStyle: true,
    })
    expect(preset?.force).toBe(true)
  })

  it('throws when any required env value is missing', () => {
    expect(() =>
      readS3EnvPreset({
        HELIOS_INTEGRATION_STORAGE_S3_ACCESS_KEY_ID: 'AKIAEXAMPLE',
        HELIOS_INTEGRATION_STORAGE_S3_SECRET_ACCESS_KEY: 'secret',
      }),
    ).toThrow(/Incomplete S3 env preset/)
  })

  it('saves credentials and writes an info log when applied for the first time', async () => {
    const saved: Array<Record<string, unknown>> = []
    const logCalls: Array<{ message: string; payload?: Record<string, unknown> }> = []

    const credentialsService = {
      getRaw: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (_integrationId, credentials) => {
        saved.push(credentials as Record<string, unknown>)
      }),
    } as unknown as CredentialsService

    const integrationLogService = {
      scoped: jest.fn(() => ({
        info: async (message: string, payload?: Record<string, unknown>) => {
          logCalls.push({ message, payload })
        },
      })),
    } as unknown as IntegrationLogService

    const result = await applyS3EnvPreset({
      credentialsService,
      integrationLogService,
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      env: {
        HELIOS_INTEGRATION_STORAGE_S3_ACCESS_KEY_ID: 'AKIAEXAMPLE',
        HELIOS_INTEGRATION_STORAGE_S3_SECRET_ACCESS_KEY: 'secret',
        HELIOS_INTEGRATION_STORAGE_S3_REGION: 'eu-central-1',
        HELIOS_INTEGRATION_STORAGE_S3_BUCKET: 'helios-bucket',
      },
    })

    expect(result).toEqual({ status: 'configured' })
    expect(saved).toEqual([
      {
        authMode: 'access_keys',
        accessKeyId: 'AKIAEXAMPLE',
        secretAccessKey: 'secret',
        region: 'eu-central-1',
        bucket: 'helios-bucket',
      },
    ])
    expect(logCalls).toHaveLength(1)
    expect(logCalls[0].payload).toMatchObject({
      region: 'eu-central-1',
      bucket: 'helios-bucket',
      endpoint: null,
    })
  })

  it('skips when credentials already exist and force is not set', async () => {
    const credentialsService = {
      getRaw: jest.fn().mockResolvedValue({ accessKeyId: 'existing' }),
      save: jest.fn(),
    } as unknown as CredentialsService

    const integrationLogService = {
      scoped: jest.fn(() => ({ info: jest.fn() })),
    } as unknown as IntegrationLogService

    const result = await applyS3EnvPreset({
      credentialsService,
      integrationLogService,
      scope: { tenantId: 't', organizationId: 'o' },
      env: {
        HELIOS_INTEGRATION_STORAGE_S3_ACCESS_KEY_ID: 'AKIAEXAMPLE',
        HELIOS_INTEGRATION_STORAGE_S3_SECRET_ACCESS_KEY: 'secret',
        HELIOS_INTEGRATION_STORAGE_S3_REGION: 'eu-central-1',
        HELIOS_INTEGRATION_STORAGE_S3_BUCKET: 'helios-bucket',
      },
    })

    expect(result.status).toBe('skipped')
    expect(credentialsService.save).not.toHaveBeenCalled()
  })

  it('overwrites existing credentials when force is true', async () => {
    const saveSpy = jest.fn()
    const credentialsService = {
      getRaw: jest.fn().mockResolvedValue({ accessKeyId: 'existing' }),
      save: saveSpy,
    } as unknown as CredentialsService

    const integrationLogService = {
      scoped: jest.fn(() => ({ info: jest.fn() })),
    } as unknown as IntegrationLogService

    const result = await applyS3EnvPreset({
      credentialsService,
      integrationLogService,
      scope: { tenantId: 't', organizationId: 'o' },
      force: true,
      env: {
        HELIOS_INTEGRATION_STORAGE_S3_ACCESS_KEY_ID: 'AKIAEXAMPLE',
        HELIOS_INTEGRATION_STORAGE_S3_SECRET_ACCESS_KEY: 'secret',
        HELIOS_INTEGRATION_STORAGE_S3_REGION: 'eu-central-1',
        HELIOS_INTEGRATION_STORAGE_S3_BUCKET: 'helios-bucket',
      },
    })

    expect(result.status).toBe('configured')
    expect(saveSpy).toHaveBeenCalledTimes(1)
  })

  it('honors HELIOS_INTEGRATION_STORAGE_S3_FORCE_PRECONFIGURE when no explicit force is passed', async () => {
    const saveSpy = jest.fn()
    const credentialsService = {
      getRaw: jest.fn().mockResolvedValue({ accessKeyId: 'existing' }),
      save: saveSpy,
    } as unknown as CredentialsService

    const integrationLogService = {
      scoped: jest.fn(() => ({ info: jest.fn() })),
    } as unknown as IntegrationLogService

    const result = await applyS3EnvPreset({
      credentialsService,
      integrationLogService,
      scope: { tenantId: 't', organizationId: 'o' },
      env: {
        HELIOS_INTEGRATION_STORAGE_S3_ACCESS_KEY_ID: 'AKIAEXAMPLE',
        HELIOS_INTEGRATION_STORAGE_S3_SECRET_ACCESS_KEY: 'secret',
        HELIOS_INTEGRATION_STORAGE_S3_REGION: 'eu-central-1',
        HELIOS_INTEGRATION_STORAGE_S3_BUCKET: 'helios-bucket',
        HELIOS_INTEGRATION_STORAGE_S3_FORCE_PRECONFIGURE: 'true',
      },
    })

    expect(result.status).toBe('configured')
    expect(saveSpy).toHaveBeenCalledTimes(1)
  })
})
