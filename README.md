# Helios Flow

<p align="center">
  <img src="./apps/helios/public/helios.svg" alt="Helios Flow" width="96" />
</p>

<p align="center">
  A modular business platform for workflow automation, operating data, and governed AI assistants.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-green.svg" /></a>
  <a href="https://nodejs.org/"><img alt="Node.js 24" src="https://img.shields.io/badge/node-24.x-brightgreen.svg" /></a>
  <img alt="Yarn 4" src="https://img.shields.io/badge/yarn-4.17-blue.svg" />
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-7-blue.svg" />
</p>

Helios Flow is an open-source, multi-tenant operating platform that combines CRM, sales, catalog, workflow automation, and typed AI assistants in one modular monorepo. It is designed for teams that need auditable business operations: natural-language workflow drafting, human approval gates, tenant-aware data access, and reusable admin building blocks.

The current product direction is simple: describe a business process in natural language, let the AI assistant draft or explain the workflow, review the proposed changes, then run the workflow with tasks, timers, notifications, webhooks, and API actions.

## Live Experience

| Surface | URL | Purpose |
|---------|-----|---------|
| Dark landing page | [duang777.github.io/helios-landing](https://duang777.github.io/helios-landing/) | Public first impression and product positioning |
| Helios layout page | [duang777.github.io/helios-landing/helios](https://duang777.github.io/helios-landing/helios/) | Alternate layout page for the Helios visual direction |
| Static product demo | [duang777.github.io/helios-landing/demo](https://duang777.github.io/helios-landing/demo/) | GitHub Pages demo of the Helios workspace experience |

The static demo lives in `apps/demo`. It is a pure frontend export that reuses the workspace UI conventions and showcases a NavInfo-style operating scenario with AI-assisted cross-module actions.

## What Is Built

### Platform Modules

- **Customers and CRM**: companies, contacts, opportunities, timelines, and custom fields.
- **Sales operations**: quotes, orders, documents, and related commercial flows.
- **Catalog**: products, categories, offers, channels, and merchandising primitives.
- **Workflows**: definitions, visual editing, instances, tasks, timers, and activity runners.
- **Directory**: tenants, organizations, hierarchy-aware visibility, and user membership.
- **Auth and RBAC**: sessions, roles, feature grants, and wildcard feature checks.
- **Integrations and sync**: provider credentials, health state, sync runs, and adapters.
- **Notifications, webhooks, scheduler, queue, search, cache**: shared runtime infrastructure.
- **Customer portals**: self-service pages gated by customer authentication and feature access.

### AI Assistant Layer

- Typed agent and tool definitions through `defineAiAgent` and `defineAiTool`.
- Module-scoped assistants that can inspect and operate on business data.
- Global AI launcher in the admin workspace.
- Pending-action approval flow before AI-initiated mutations land.
- Tool packs for schema-aware reads, workflow guidance, and controlled write actions.

### GitHub Pages Demo

- Static Next.js app at `apps/demo`.
- Helios-style intro animation before entering the product demo.
- Simulated backend workspace with modules, records, filters, activity logs, and AI dock.
- No backend dependency and no real login request.
- Built with `NEXT_PUBLIC_DEMO_BASE_PATH=/helios-landing/demo yarn demo:build`.

## Current Development Status

The project is currently on the `buddy/workflow-ai-draft` branch for the demo and workflow-AI presentation work.

Ready to merge into `main`:

- `apps/demo`: standalone static demo app for GitHub Pages.
- Root scripts: `yarn demo:dev` and `yarn demo:build`.
- `.github/workflows/demo-pages.yml`: optional GitHub Pages workflow for deploying `apps/demo/out`.
- README refresh: professional open-source project overview, live links, quick start, architecture, and roadmap.

Already deployed through the landing repository:

- Dark landing page: `https://duang777.github.io/helios-landing/`
- Helios layout page: `https://duang777.github.io/helios-landing/helios/`
- Demo page: `https://duang777.github.io/helios-landing/demo/`

Do not merge local temporary artifacts such as `.tmp/`, `.workbuddy/`, `deliverables/`, generated recordings, downloaded doc resources, or local `.env` backups unless a separate task explicitly promotes them.

## Architecture

Helios is organized as a Yarn workspace monorepo.

| Path | Responsibility |
|------|----------------|
| `apps/helios` | Main Next.js admin and API application |
| `apps/demo` | Static GitHub Pages demo app |
| `apps/docs` | Documentation site |
| `packages/core` | Domain modules and platform services |
| `packages/ai-assistant` | Typed agents, tools, chat APIs, and AI runtime surfaces |
| `packages/ui` | Shared admin, backend, and portal UI components |
| `packages/shared` | Shared types, data helpers, i18n, and utility libraries |
| `packages/cli` | `helios` command-line tooling |
| `packages/cache`, `queue`, `events`, `search`, `webhooks`, `scheduler` | Runtime infrastructure packages |
| `packages/enterprise` | Optional enterprise modules |

Core platform features are implemented as modules. Modules own their entities, APIs, pages, setup hooks, events, permissions, and UI registrations. Generated registries wire those modules into the app.

## Tech Stack

- **Frontend**: Next.js App Router, React, TypeScript, Tailwind CSS
- **Backend**: Next.js route handlers, modular service layer, Awilix DI
- **Database**: PostgreSQL with MikroORM
- **Jobs and cache**: Redis-backed queue and cache packages
- **Search**: optional Meilisearch integration
- **AI**: typed agent/tool runtime with approval-aware mutation flow
- **Tooling**: Yarn 4 workspaces, Turbo, Jest, Playwright, project CLI

## Quick Start

Requirements:

- Node.js 24.x
- Yarn 4 via Corepack
- Docker, for local PostgreSQL and Redis

```bash
git clone git@github.com:Duang777/helios-flow.git
cd helios-flow
corepack enable
corepack prepare yarn@4.17.1 --activate
yarn install
```

Create the app environment:

```bash
cp apps/helios/.env.example apps/helios/.env
```

Update `apps/helios/.env` with database, Redis, JWT, and AI provider settings. For local development you can use the default Docker services:

```bash
docker compose up -d postgres redis
yarn dev
```

Open the app:

- Login: `http://localhost:3000/login`
- Backend workspace: `http://localhost:3000/backend`
- Start page: `http://localhost:3000/start`

Default local accounts created by initialization:

| Role | Email | Password |
|------|-------|----------|
| Superadmin | `superadmin@acme.com` | `secret` |
| Admin | `admin@acme.com` | `secret` |
| Employee | `employee@acme.com` | `secret` |

For a clean first boot that prepares the local app database and seed data:

```bash
yarn dev:greenfield
```

Use this on a fresh local database, or when you intentionally want a reset-style setup.

## Static Demo

Run the demo locally:

```bash
yarn demo:dev
```

Build the demo as a standalone static export:

```bash
yarn demo:build
```

Build it for the deployed GitHub Pages subpath:

```bash
NEXT_PUBLIC_DEMO_BASE_PATH=/helios-landing/demo yarn demo:build
```

The output is written to `apps/demo/out` and can be copied to a Pages-hosted repository or uploaded by the demo workflow.

## Common Commands

| Command | Description |
|---------|-------------|
| `yarn dev` | Start the main Helios development server |
| `yarn dev:greenfield` | Initialize and run a fresh local development environment |
| `yarn build` | Build packages, generate registries, then build the app |
| `yarn build:packages` | Build workspace packages |
| `yarn build:app` | Build the main app |
| `yarn typecheck` | Run workspace type checks |
| `yarn lint` | Run workspace lint checks |
| `yarn test` | Run unit tests |
| `yarn test:integration` | Run Playwright integration tests |
| `yarn generate` | Regenerate module discovery registries |
| `yarn db:generate` | Generate database migrations from entity changes |
| `yarn db:migrate` | Apply pending migrations |
| `yarn initialize` | Seed or re-seed local defaults |
| `yarn demo:dev` | Start the static demo app locally |
| `yarn demo:build` | Build the static demo export |
| `yarn docs:dev` | Start the documentation site |

## Local Port Conflicts

`docker compose` reads the repo-root `.env`, while the app reads `apps/helios/.env`. If another project already uses `5432` or `6379`, keep it running and give Helios its own ports.

Repo-root `.env`:

```bash
POSTGRES_PORT=55432
REDIS_PORT=56379
POSTGRES_DB=helios
```

`apps/helios/.env`:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:55432/helios
REDIS_URL=redis://localhost:56379
```

Recreate only the Helios services:

```bash
docker compose up -d --force-recreate postgres redis
```

## Validation

Choose the smallest relevant validation set for your change:

```bash
yarn generate
yarn build:packages
yarn typecheck
yarn lint
yarn test
yarn build:app
yarn demo:build
```

For browser-facing changes, verify with Playwright or a real browser. For module or contract changes, also review `BACKWARD_COMPATIBILITY.md` and the relevant `AGENTS.md` guide before merging.

## Merge Plan for This Branch

Recommended sequence for merging the current demo work into `main`:

```bash
git status --short
git add README.md .gitignore package.json yarn.lock .github/workflows/demo-pages.yml apps/demo
git restore --staged apps/demo/.next apps/demo/out apps/demo/node_modules apps/demo/next-env.d.ts 2>/dev/null || true
git commit -m "feat: add static Helios demo"
git fetch origin main
git rebase origin/main
yarn demo:build
git push origin buddy/workflow-ai-draft
```

Then open a pull request from `buddy/workflow-ai-draft` into `main`. Keep unrelated local artifacts out of the PR.

## Roadmap

- Workflow AI tools for suggesting, explaining, creating, updating, and starting workflow definitions.
- Tighter integration between the workflow visual editor and AI-generated draft review.
- Broader tool coverage for CRM, sales, catalog, and operating-loop scenarios.
- More production-grade demo datasets and guided walkthroughs.
- GitHub Pages demo hardening and visual polish.

## Documentation

- Product requirements: [docs/PRD.md](./docs/PRD.md)
- Module walkthroughs: [docs/module-walkthroughs/index.html](./docs/module-walkthroughs/index.html)
- Operating loop walkthrough: [docs/operating-loop-walkthrough.md](./docs/operating-loop-walkthrough.md)
- Agent guidelines: [AGENTS.md](./AGENTS.md)
- Backward compatibility policy: [BACKWARD_COMPATIBILITY.md](./BACKWARD_COMPATIBILITY.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)

## Contributing

Contributions should preserve tenant isolation, module boundaries, generated registries, and optimistic locking rules. Before opening a pull request:

1. Read [AGENTS.md](./AGENTS.md) and any package-level `AGENTS.md` files for the area you are changing.
2. Keep changes focused and avoid unrelated cleanup.
3. Run the smallest relevant validation set.
4. Document user-facing changes, public contract changes, and migration notes.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the broader contribution process.

## Security

Do not commit credentials, private keys, local `.env` files, provider tokens, or production data. Report security issues through [SECURITY.md](./SECURITY.md).

## License

MIT. See [LICENSE](./LICENSE).
