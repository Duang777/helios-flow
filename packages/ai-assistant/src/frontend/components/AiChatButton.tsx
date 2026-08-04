'use client'

import * as React from 'react'
import { AiIcon } from '@helios/ui/ai/AiIcon'
import { Button } from '@helios/ui/primitives/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@helios/ui/primitives/tooltip'

interface AiChatButtonProps {
  onClick?: () => void
  className?: string
}

export function AiChatButton({ onClick, className }: AiChatButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    onClick?.()
  }

  const isMac = typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().indexOf('MAC') >= 0

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClick}
            className={className}
            aria-label="Open AI Assistant"
          >
            <AiIcon className="h-5 w-5 text-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>AI Assistant ({isMac ? '⌘' : 'Ctrl+'}J)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
