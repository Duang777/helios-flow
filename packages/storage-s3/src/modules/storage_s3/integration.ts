import type { IntegrationBundle, IntegrationDefinition } from '@helios/shared/modules/integrations/types'

export const integration: IntegrationDefinition = {
  id: 'storage_s3',
  title: 'S3-Compatible Storage',
  titleKey: 'integrations.providers.storage_s3.title',
  description:
    'Store attachments and files in AWS S3, DigitalOcean Spaces, MinIO, or any S3-compatible object storage.',
  descriptionKey: 'integrations.providers.storage_s3.description',
  category: 'storage',
  hub: 'storage_hubs',
  icon: 's3',
  package: '@helios/storage-s3',
  version: '1.0.0',
  author: 'Helios Team',
  company: 'Helios',
  license: 'MIT',
  tags: ['s3', 'aws', 'storage', 'minio', 'digitalocean-spaces'],
  healthCheck: { service: 's3HealthCheck' },
  credentials: {
    fields: [
      {
        key: 'authMode',
        label: 'Authentication',
        labelKey: 'integrations.providers.storage_s3.credentials.authMode.label',
        type: 'select',
        required: false,
        helpText:
          'Choose how the AWS SDK should authenticate. For production deployments, prefer IAM roles (IRSA/instance profile) when available.',
        helpTextKey: 'integrations.providers.storage_s3.credentials.authMode.help',
        options: [
          { value: 'access_keys', label: 'Access keys', labelKey: 'integrations.providers.storage_s3.credentials.authMode.options.access_keys' },
          { value: 'ambient', label: 'Credentials provided by AWS (STS / IRSA / instance profile)', labelKey: 'integrations.providers.storage_s3.credentials.authMode.options.ambient' },
        ],
      },
      {
        key: 'accessKeyId',
        label: 'Access Key ID',
        labelKey: 'integrations.providers.storage_s3.credentials.accessKeyId.label',
        type: 'text',
        required: true,
        placeholder: 'AKIAIOSFODNN7EXAMPLE',
        helpText:
          'AWS IAM access key ID, or the equivalent key for your S3-compatible provider.',
        helpTextKey: 'integrations.providers.storage_s3.credentials.accessKeyId.help',
        visibleWhen: { field: 'authMode', equals: 'access_keys' },
      },
      {
        key: 'secretAccessKey',
        label: 'Secret Access Key',
        labelKey: 'integrations.providers.storage_s3.credentials.secretAccessKey.label',
        type: 'secret',
        required: true,
        helpText:
          'AWS IAM secret access key, or the equivalent secret for your S3-compatible provider.',
        helpTextKey: 'integrations.providers.storage_s3.credentials.secretAccessKey.help',
        visibleWhen: { field: 'authMode', equals: 'access_keys' },
      },
      {
        key: 'sessionToken',
        label: 'Session Token (optional)',
        labelKey: 'integrations.providers.storage_s3.credentials.sessionToken.label',
        type: 'secret',
        required: false,
        helpText:
          'Optional AWS session token when using temporary credentials (e.g. from STS).',
        helpTextKey: 'integrations.providers.storage_s3.credentials.sessionToken.help',
        visibleWhen: { field: 'authMode', equals: 'access_keys' },
      },
      {
        key: 'region',
        label: 'Region',
        labelKey: 'integrations.providers.storage_s3.credentials.region.label',
        type: 'text',
        required: true,
        placeholder: 'eu-central-1',
        helpText: 'AWS region (e.g. eu-central-1). For DigitalOcean Spaces use the slug like fra1.',
        helpTextKey: 'integrations.providers.storage_s3.credentials.region.help',
      },
      {
        key: 'bucket',
        label: 'Bucket Name',
        labelKey: 'integrations.providers.storage_s3.credentials.bucket.label',
        type: 'text',
        required: true,
        placeholder: 'my-company-attachments',
        helpText: 'The S3 bucket where files will be stored.',
        helpTextKey: 'integrations.providers.storage_s3.credentials.bucket.help',
      },
      {
        key: 'endpoint',
        label: 'Custom Endpoint',
        labelKey: 'integrations.providers.storage_s3.credentials.endpoint.label',
        type: 'url',
        required: false,
        placeholder: 'https://fra1.digitaloceanspaces.com',
        helpText: 'Custom S3 endpoint URL. Leave empty for AWS S3. Required for MinIO, DigitalOcean Spaces, and other providers.',
        helpTextKey: 'integrations.providers.storage_s3.credentials.endpoint.help',
      },
      {
        key: 'forcePathStyle',
        label: 'Force Path Style',
        labelKey: 'integrations.providers.storage_s3.credentials.forcePathStyle.label',
        type: 'boolean',
        required: false,
        helpText: 'Enable path-style addressing. Required for MinIO. Leave disabled for AWS S3 and DigitalOcean Spaces.',
        helpTextKey: 'integrations.providers.storage_s3.credentials.forcePathStyle.help',
      },
    ],
  },
}

export const integrations: IntegrationDefinition[] = [integration]
export const bundles: IntegrationBundle[] = []
export const bundle: IntegrationBundle | undefined = undefined
