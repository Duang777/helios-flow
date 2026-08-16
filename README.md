<p align="center">
  <img src="./apps/helios/public/helios.svg" alt="Helios Flow" width="96" />
</p>

# Helios Flow

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-24.x-brightgreen.svg)](https://nodejs.org/)
[![Landing](https://img.shields.io/badge/landing-live-0c0b0a.svg)](https://duang777.github.io/helios-landing/)

**Product landing:** [duang777.github.io/helios-landing](https://duang777.github.io/helios-landing/)

Helios Flow is a modular business platform with a workflow engine and typed AI assistants. The product focus is turning natural language into runnable workflows, on top of multi-tenant CRM, sales, catalog, and admin building blocks that already ship in this monorepo.

You describe a process in plain language. The assistant drafts a workflow definition. You review it, then the engine can run it with steps, human tasks, timers, emails, webhooks, and API actions.

## Product focus

- Draft approval flows, handoffs, and multi-step ops processes from a short prompt
- Create, update, and explain workflow definitions in the admin UI
- Start workflow instances and track tasks under tenant and organization scope
- Keep write actions behind mutation approval when the assistant changes data

## Platform capabilities

These modules and platform features are already in the repo and usable while the natural language workflow path is being sharpened.

### Domain modules

- **Customers / CRM**: people, companies, deals, timelines, and flexible custom fields
- **Catalog**: products, categories, offers, and channel-oriented merchandising
- **Sales / documents**: quotes, orders, and related document flows
- **Workflows**: visual editor, code definitions, instances, user tasks, timers, and activity runners
- **Directory**: tenants, organizations, and hierarchical org visibility
- **Auth and RBAC**: users, roles, sessions, and feature-based access control
- **Customer portals**: self-service pages gated by customer auth and features
- **Integrations and data sync**: credentials, health, sync runs, and provider adapters
- **Attachments, search, notifications, webhooks, scheduler, queue**: shared ops plumbing

### Platform foundations

- **Modular architecture**: each feature lives in a module with auto-discovered pages, APIs, CLI, i18n, and DB entities
- **Custom entities and dynamic forms**: declare fields and manage them from admin without hard-coding every UI
- **Multi-tenant by default**: tenant and organization scoping on entities and APIs
- **Feature-based RBAC**: role and user feature grants, including wildcard grants like `module.*`
- **Command-based writes**: audit, undo hooks, cache invalidation, and events stay consistent
- **Events and subscribers**: domain events with ephemeral or persistent handlers
- **Query indexing and caching**: fast list and search paths across base and custom fields
- **Encryption helpers**: tenant-scoped field encryption for sensitive data
- **Typed AI framework**: `defineAiAgent` / `defineAiTool`, tool packs, and pending-action approvals
- **Design-system admin UI**: shared tables, forms, shells, and injection spots for cross-module UI

### AI surfaces today

- Module-scoped assistants (for example customers and catalog) with schema and API tools
- Global assistant launcher in the admin chrome
- Mutation approvals before data changes land
- MCP / code-mode tooling for broader API exploration when enabled

Workflow-specific agent tools (suggest definition, create or update definition, start instance, explain) are the active build target on top of this stack.

## Stack

- App: Next.js (App Router), TypeScript
- Data: PostgreSQL, MikroORM
- Jobs and cache: Redis
- Search (optional): Meilisearch
- Packages managed with Yarn 4 workspaces
- CLI: `helios`

## Quick start

You need Node.js 24, Docker (for Postgres and Redis), and Yarn 4.

```bash
git clone git@github.com:Duang777/helios-flow.git
cd helios-flow
corepack enable && corepack prepare yarn@4.17.1 --activate
docker compose up -d
cp apps/helios/.env.example apps/helios/.env
# set DATABASE_URL, JWT secrets, and at least one LLM API key in apps/helios/.env
yarn dev:greenfield
```

Open http://localhost:3000/backend. Login credentials are printed in the terminal.

For AI chat features, set the LLM provider keys documented in `apps/helios/.env.example`.

Local docs site:

```bash
yarn workspace helios-docs dev
```

## Repo layout

| Path | Role |
|------|------|
| `apps/helios` | Main admin and API app |
| `apps/docs` | Documentation site |
| `packages/core` | Domain modules (customers, sales, catalog, workflows, auth, …) |
| `packages/ai-assistant` | Typed AI agents, tools, and chat APIs |
| `packages/ui` | Shared admin and portal UI |
| `packages/shared` | Shared libs, CRUD helpers, i18n |
| `packages/cli` | `helios` CLI |
| `packages/enterprise` | Optional enterprise modules |
| `packages/queue` / `events` / `search` / `webhooks` / `scheduler` | Runtime services |

## Current build plan

1. Confirm local greenfield boot and LLM chat
2. Add workflow AI tools: suggest, create or update definition, start instance, explain
3. Wire suggestions into the visual workflow editor with an explicit accept step

## Docs and contribution

- Product landing: [https://duang777.github.io/helios-landing/](https://duang777.github.io/helios-landing/)
- Agent notes for this monorepo: [AGENTS.md](./AGENTS.md)
- Specs and ADRs: [`.ai/specs/`](./.ai/specs/)
- Security: [SECURITY.md](./SECURITY.md)
- License: [LICENSE](./LICENSE)

## License

MIT
