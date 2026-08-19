'use client'

import * as React from 'react'
import { AiIcon } from '@helios/ui/ai/AiIcon'
import {
  AiChat,
  type AiChatContextItem,
  type AiChatSuggestion,
} from '@helios/ui/ai/AiChat'
import { Button } from '@helios/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@helios/ui/primitives/dialog'
import { useT } from '@helios/shared/lib/i18n/context'
import { cn } from '@helios/shared/lib/utils'
import type { InjectionWidgetComponentProps } from '@helios/shared/modules/widgets/injection'
import {
  buildOperatingLoopPageContext,
  type OperatingLoopPageContext,
} from './page-context'

export const OPERATING_LOOP_ASSISTANT_ID = 'insights.operating_loop_assistant'

type OperatingLoopTriggerProps = InjectionWidgetComponentProps<
  Record<string, unknown>,
  Record<string, unknown>
>

function buildContextItems(pageContext: OperatingLoopPageContext): AiChatContextItem[] {
  const items: AiChatContextItem[] = [
    {
      label: pageContext.recordType,
      detail: pageContext.recordId ?? pageContext.tableId ?? pageContext.view,
    },
  ]
  if (pageContext.organizationId) {
    items.push({ label: 'organizationId', detail: pageContext.organizationId })
  }
  if (pageContext.extra.dealId) {
    items.push({ label: 'dealId', detail: pageContext.extra.dealId })
  }
  if (pageContext.extra.projectId) {
    items.push({ label: 'projectId', detail: pageContext.extra.projectId })
  }
  if (pageContext.extra.contractId) {
    items.push({ label: 'contractId', detail: pageContext.extra.contractId })
  }
  return items
}

function buildSuggestions(t: (key: string, fallback?: string) => string): AiChatSuggestion[] {
  return [
    {
      label: t('insights.operatingLoop.suggestion.fullLoop.label', 'Full loop'),
      prompt: t(
        'insights.operatingLoop.suggestion.fullLoop.prompt',
        '从当前客户/商机或订单往下看：项目是否延期，合同回款怎样，KPI 差多少，有哪些治理检出？请给出数字、公式来源、证据 ID 和后台链接。',
      ),
    },
    {
      label: t('insights.operatingLoop.suggestion.actions.label', 'Next actions'),
      prompt: t(
        'insights.operatingLoop.suggestion.actions.prompt',
        '基于当前页面上下文给出处置建议。需要写入的动作先生成确认卡，不要直接声称已经完成。',
      ),
    },
  ]
}

export default function OperatingLoopTriggerWidget({ context, data }: OperatingLoopTriggerProps) {
  const t = useT()
  const [open, setOpen] = React.useState(false)
  const pageContext = React.useMemo(
    () => buildOperatingLoopPageContext(context, data),
    [context, data],
  )
  const suggestions = React.useMemo(() => buildSuggestions(t), [t])
  const contextItems = React.useMemo(
    () => (pageContext ? buildContextItems(pageContext) : []),
    [pageContext],
  )

  if (!pageContext) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-operating-loop-ai-trigger=""
          data-operating-loop-record-id={pageContext.recordId ?? undefined}
          data-operating-loop-table-id={pageContext.tableId ?? undefined}
          aria-label={t('insights.operatingLoop.trigger.ariaLabel', 'Open Operating Loop Assistant')}
        >
          <AiIcon className="size-4" />
          <span>{t('insights.operatingLoop.trigger.label', 'Ask Operating AI')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          'sm:max-w-xl sm:top-0 sm:bottom-0 sm:right-0 sm:left-auto sm:translate-x-0 sm:translate-y-0',
          'sm:h-screen sm:max-h-screen sm:rounded-none sm:rounded-l-2xl',
          'flex flex-col gap-3 p-4 z-[70]',
        )}
        data-operating-loop-ai-sheet=""
      >
        <DialogHeader>
          <DialogTitle>
            {t('insights.operatingLoop.sheet.title', 'Operating Loop Assistant')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'insights.operatingLoop.sheet.description',
              'Ask about this record across customers, sales documents, catalog, projects, settlement, KPI gaps, and governance findings.',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1" data-operating-loop-ai-chat-container="">
          <AiChat
            agent={OPERATING_LOOP_ASSISTANT_ID}
            pageContext={pageContext as unknown as Record<string, unknown>}
            className="h-full"
            suggestions={suggestions}
            contextItems={contextItems}
            placeholder={t(
              'insights.operatingLoop.sheet.placeholder',
              'Ask about customers, orders, delays, collection, KPI gaps, findings...',
            )}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
