declare module '@/.helios/generated/inbox-actions.generated' {
  import type { InboxActionDefinition } from '@helios/shared/modules/inbox-actions'

  export const inboxActionConfigEntries: Array<{
    moduleId: string
    actions: InboxActionDefinition[]
  }>
  export const inboxActions: InboxActionDefinition[]
  export function getInboxAction(type: string): InboxActionDefinition | undefined
  export function getRegisteredActionTypes(): string[]
}
