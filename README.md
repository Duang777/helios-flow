<p align="center">
  <img src="./apps/helios/public/helios.svg" alt="Helios Flow" width="96" />
</p>

# Helios Flow

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-24.x-brightgreen.svg)](https://nodejs.org/)

Helios Flow turns natural language into runnable business workflows.

You describe a process in plain language. The assistant drafts a workflow definition, you review it, then the engine can run it with steps, approvals, timers, and API actions.

## What it is for

- Draft approval flows, handoffs, and multi-step ops processes from a short prompt
- Edit and explain existing workflows in the admin UI
- Start workflow instances and track tasks under tenant and organization scope

## Stack

- App: Next.js (App Router), TypeScript
- Data: PostgreSQL, MikroORM
- Jobs and cache: Redis
- Search (optional): Meilisearch
- Packages managed with Yarn 4 workspaces

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

## Repo layout

| Path | Role |
|------|------|
| `apps/helios` | Main admin and API app |
| `apps/docs` | Local documentation site |
| `packages/core` | Domain modules, including workflows |
| `packages/ai-assistant` | Typed AI agents, tools, and chat APIs |
| `packages/ui` | Shared admin UI |
| `packages/cli` | `helios` CLI |

## Current focus

1. Local greenfield setup that boots cleanly
2. Workflow-specific AI tools: suggest, create or update definitions, start instances, explain
3. Optional bridge from AI suggestions into the visual workflow editor

## Docs and contribution

- Agent notes for this monorepo: [AGENTS.md](./AGENTS.md)
- Security: [SECURITY.md](./SECURITY.md)
- License: [LICENSE](./LICENSE)

## License

MIT
