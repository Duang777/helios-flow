import { hashForLookup, lookupHashCandidates } from '@helios/shared/lib/encryption/aes'

export function computeEmailHash(email: string): string {
  return hashForLookup(email)
}

export function emailHashLookupValues(email: string): string[] {
  return lookupHashCandidates(email)
}
