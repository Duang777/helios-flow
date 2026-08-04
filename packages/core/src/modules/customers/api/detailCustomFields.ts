import { normalizeCustomFieldResponse } from '@helios/shared/lib/custom-fields/normalize'

export function normalizeCustomerDetailCustomFields(
  values: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return normalizeCustomFieldResponse(values) ?? {}
}
