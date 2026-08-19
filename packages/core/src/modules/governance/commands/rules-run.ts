import { registerCommand } from '@helios/shared/lib/commands'
import type { CommandHandler } from '@helios/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveTranslations } from '@helios/shared/lib/i18n/server'
import { withAtomicFlush } from '@helios/shared/lib/commands/flush'
import { rulesRunSchema, type RulesRunInput } from '../data/validators'
import { runGovernanceRulePack } from '../lib/rules'
import { emitGovernanceEvent } from '../events'
import { ensureGovernanceCommandScope } from './scope'

export type RulesRunResult = {
  created: number
  updated: number
  asOf: string
  ruleCount: number
  candidateCount: number
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

const runGovernanceRulesCommand: CommandHandler<RulesRunInput, RulesRunResult> = {
  id: 'governance.rules.run',
  async execute(input, ctx) {
    const parsed = rulesRunSchema.parse(input)
    ensureGovernanceCommandScope(ctx, parsed)

    const asOf = parsed.asOf ?? todayUtcDate()
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    let summary!: RulesRunResult

    await withAtomicFlush(
      em,
      [
        async () => {
          summary = await runGovernanceRulePack(em, {
            tenantId: parsed.tenantId,
            organizationId: parsed.organizationId,
            asOf,
          })
        },
      ],
      { transaction: true, label: 'governance.rules.run' },
    )

    await emitGovernanceEvent('governance.rules.run', {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      ...summary,
    })

    return summary
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('governance.audit.rulesRun', 'Run governance rules'),
      resourceKind: 'governance.rules',
      resourceId: result.asOf,
      tenantId: null,
      organizationId: null,
      payload: { result },
    }
  },
}

registerCommand(runGovernanceRulesCommand)

export { runGovernanceRulesCommand }
