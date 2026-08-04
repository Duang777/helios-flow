// Re-export from shared for backward compatibility
// New code should import directly from @helios/shared/modules/entities/validators
export {
  entityIdRegex,
  fieldsetCodeRegex,
  upsertCustomEntitySchema,
  upsertCustomFieldDefSchema,
  customFieldsetGroupSchema,
  customFieldsetSchema,
  customFieldEntityConfigSchema,
  encryptionFieldRuleSchema,
  upsertEncryptionMapSchema,
  type UpsertCustomEntityInput,
  type UpsertCustomFieldDefInput,
  type UpsertEncryptionMapInput,
} from '@helios/shared/modules/entities/validators'
