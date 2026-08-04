"use client"

import type { MessageActionsProps } from '@helios/shared/modules/messages/types'
import { useT } from '@helios/shared/lib/i18n/context'
import { Button } from '@helios/ui/primitives/button'

export function DefaultMessageActions({
  message,
  onExecuteAction,
  isExecuting,
  executingActionId,
}: MessageActionsProps) {
  const t = useT()
  const actions = message.actionData?.actions ?? []

  if (actions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={action.variant ?? 'default'}
          size="sm"
          onClick={() => onExecuteAction(action.id)}
          disabled={isExecuting || !!message.actionTaken}
        >
          {isExecuting && executingActionId === action.id
            ? t('messages.actions.executing', 'Executing...')
            : t(action.labelKey ?? action.label, action.label)}
        </Button>
      ))}
    </div>
  )
}

export default DefaultMessageActions
