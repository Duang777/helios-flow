# AI Assistant Package Guidelines

This file is the compact rule index for `@helios/ai-assistant`. Long-form
historical guidance was moved to
`../../.ai/docs/agent-guides/ai-assistant-agents-guidelines.md`.

Primary docs:

- `apps/docs/docs/framework/ai-assistant/architecture.mdx`
- `apps/docs/docs/framework/ai-assistant/developer-guide.mdx`
- `apps/docs/docs/framework/ai-assistant/agents.mdx`
- `apps/docs/docs/framework/ai-assistant/mutation-approvals.mdx`
- `apps/docs/docs/framework/ai-assistant/overrides.mdx`
- `apps/docs/docs/framework/ai-assistant/playground.mdx`
- `.ai/skills/helios-create-ai-agent/SKILL.md`

## Always

- Treat the public AI assistant docs as source of truth when they disagree with
  this file.
- Use `defineAiTool` / `defineApiBackedAiTool` for typed module tools; use
  `registerMcpTool` only for legacy/OpenCode MCP surfaces that intentionally do
  not need focused-agent mutation approval.
- Give every data-touching tool Zod `inputSchema`, `requiredFeatures`, and a
  serializable handler result.
- Use `createAiApiOperationRunner(ctx).run(...)` when an AI tool reuses Helios
  API routes; never call the app over HTTP from in-process chat flows.
- Route model selection through `createModelFactory(container)`.
- Route every AI-initiated write through the mutation approval contract:
  `isMutation: true`, non-read-only agent policy, and preview resolvers where
  possible.
- Run `yarn generate` after adding/changing agents, tools, overrides,
  API-discovery metadata, or tool packs.

## Ask First

- Ask before changing OpenCode Docker configuration, MCP authentication, provider
  or model resolution precedence, session-token semantics, or Code Mode sandboxing.
- Ask before widening shipped tool allowlists, relaxing mutation policies, or
  exposing new tenant data surfaces to an agent.
- Ask before changing AI pending-action state transitions, event IDs, approval
  card contracts, or tenant override precedence.

## Never

- Never leave `requiredFeatures` empty for tools that access tenant data.
- Never bypass endpoint-level RBAC in MCP, Code Mode, or focused-agent tools.
- Never let mutation-capable tools write directly during the proposal phase; the
  confirmed handler is the only place the write may run.
- Never log credentials, session tokens, API keys, prompt secrets, raw tenant
  data, or model-provider secrets.
- Never cache MCP server instances across requests or skip per-tool ACL checks.
- Never list `meta.update_task_plan` manually in an agent allowlist; enable it
  with `taskPlan: { enabled: true }`.

## Validation Commands

```bash
yarn generate
yarn workspace @helios/ai-assistant test
yarn workspace @helios/ai-assistant build
yarn agents:check-budget
```

## Agent And Tool Contracts

- Module agents live at `<module>/ai-agents.ts` and export
  `aiAgents: AiAgentDefinition[]`.
- Module tools live at `<module>/ai-tools.ts` or root re-export packs from
  `<module>/ai-tools/*`.
- Agent ids are frozen once shipped and use `<module>.<snake_case_name>`.
- Tool names are frozen once shipped and use `<module>.<verb_noun>`.
- Required agent fields: `id`, `moduleId`, `label`, `description`,
  `systemPrompt`, `allowedTools`.
- Default shipped posture:
  - no mutation tools: `readOnly: true`, `mutationPolicy: 'read-only'`
  - any mutation tools: `readOnly: false`, `mutationPolicy: 'confirm-required'`
- Every feature listed by an agent or tool must exist in the owning module's
  `acl.ts` and be granted in `setup.ts` as appropriate.
- Use structured prompt sections (`role`, `scope`, `data`, `tools`,
  `attachments`, `mutationPolicy`, `responseStyle`) when writing complex agents.
- Use `resolvePageContext` to append current-record context; return `null` on
  failure instead of breaking the chat turn.

## Mutation Approval

Follow `apps/docs/docs/framework/ai-assistant/mutation-approvals.mdx`.

- Set `isMutation: true` on every write tool.
- Prefer `loadBeforeRecord` for single-record writes and `loadBeforeRecords` for
  bulk writes so approval cards show real diffs and stale-version rechecks work.
- Keep preview `before`, `after`, and display hints serializable.
- The confirm path re-checks RBAC and record versions; do not duplicate or bypass
  that logic in chat flow code.
- The only owners of `ai.action.confirmed`, `ai.action.cancelled`, and
  `ai.action.expired` emissions are the pending-action confirm/cancel helpers and
  cleanup worker.

## Runtime Boundaries

- Code Mode `api.request()` must fail closed for undocumented routes and
  featureless mutation endpoints.
- Session tokens are scoped to tenant/org/user context and must be treated as
  credentials.
- MCP HTTP server requests are stateless; resolve context and ACL per request.
- SSE/debug events are diagnostics only; never encode secrets or raw private
  tenant payloads in debug output.
- `loop.prepareStep` must compose with wrapper-owned mutation guards; never return
  a tool surface that strips approval wrappers.

## Key Paths

| Area | Path |
|---|---|
| Agent definition types | `src/modules/ai_assistant/lib/ai-agent-definition.ts` |
| Tool types/registry | `src/modules/ai_assistant/lib/types.ts`, `ai-tool-definition.ts` |
| API-backed tools | `src/modules/ai_assistant/lib/api-backed-tool.ts` |
| API operation runner | `src/modules/ai_assistant/lib/ai-api-operation-runner.ts` |
| Mutation prep/confirm | `src/modules/ai_assistant/lib/prepare-mutation.ts`, `pending-action-*` |
| Runtime dispatch | `src/modules/ai_assistant/lib/agent-runtime.ts` |
| Settings/overrides | `src/modules/ai_assistant/lib/agent-policy.ts` and settings APIs |
| Generated registry loader | `src/modules/ai_assistant/lib/generated-registry-loader.ts` |
| CLI / MCP | `src/modules/ai_assistant/cli.ts`, `mcp-*` files |
