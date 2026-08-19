# Helios Flow

<p align="center">
  <img src="./apps/helios/public/helios.svg" alt="Helios Flow" width="96" />
</p>

<p align="center">
  <strong>Composable business operations, workflow automation, and governed AI assistance in one multi-tenant platform.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-16a34a.svg" /></a>
  <a href="https://nodejs.org/"><img alt="Node.js 24" src="https://img.shields.io/badge/node-24.x-339933.svg" /></a>
  <img alt="Yarn 4.17" src="https://img.shields.io/badge/yarn-4.17-2c8ebb.svg" />
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000000.svg" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149eca.svg" />
  <img alt="TypeScript 7" src="https://img.shields.io/badge/TypeScript-7-3178c6.svg" />
</p>

Helios Flow is an open-source operating platform for teams that need structured business data, auditable workflow execution, and AI assistance that can work across modules without bypassing governance. It combines CRM, sales operations, catalog management, workflow orchestration, notifications, integrations, and a typed AI assistant runtime inside a modular TypeScript monorepo.

The product thesis is straightforward: operators should be able to describe a process in natural language, review the AI-generated plan, approve controlled actions, and run the resulting workflow with traceable tasks, timers, notifications, webhooks, and API operations.

## Live Preview

| Experience | Link | What it shows |
|------------|------|---------------|
| Landing page | [duang777.github.io/helios-landing](https://duang777.github.io/helios-landing/) | Public product positioning and brand direction |
| Helios layout page | [duang777.github.io/helios-landing/helios](https://duang777.github.io/helios-landing/helios/) | Workspace layout direction and visual system |
| Static demo | [duang777.github.io/helios-landing/demo](https://duang777.github.io/helios-landing/demo/) | Pure frontend demo of the Helios workspace and AI interaction model |

The static demo is intentionally backend-free. It is designed for GitHub Pages, sales demos, and product walkthroughs where visitors should be able to experience the interface without provisioning a database, logging in, or connecting an AI provider.

## Why Helios

Business platforms often split data, workflows, and AI into separate tools. Helios is built around the opposite model: modules expose typed capabilities, the workflow layer composes those capabilities into repeatable operations, and the AI assistant works through the same controlled surfaces as the application.

Core principles:

- **Modular by default**: domain features live in packages and modules with explicit setup, permissions, events, pages, and API surfaces.
- **Tenant-aware everywhere**: data access, permissions, commands, and UI paths are designed around organization and tenant boundaries.
- **AI with governance**: AI tools are typed, scoped, reviewable, and routed through approval-aware mutation flows.
- **Generated registries, not hidden wiring**: modules are discovered and connected through generated registries so the platform can scale without manual glue code.
- **Operator-grade UX**: admin screens prioritize dense, repeatable work instead of marketing-style dashboards.

## Platform Capabilities

| Area | Capabilities |
|------|--------------|
| CRM and customer operations | Companies, people, deals, activities, comments, timelines, custom fields, and customer-facing portals |
| Sales operations | Quotes, orders, sales documents, channels, adjustments, payments, shipments, statuses, and document conversion flows |
| Catalog and merchandising | Products, variants, categories, offers, price kinds, media, option schemas, and merchandising-oriented AI tools |
| Workflow automation | Workflow definitions, visual editing, instances, tasks, timers, contextual task actions, and operation progress |
| Runtime infrastructure | Queue, scheduler, cache, search, webhooks, notifications, event bridge, and structured module setup |
| Identity and governance | Authentication, roles, feature grants, wildcard RBAC, optimistic locking, tenant scoping, and audit-oriented access patterns |
| Integrations | Provider packages, credentials, health state, sync runs, adapter boundaries, and webhook entry points |
| AI assistant | Typed agents, typed tools, tool packs, pending actions, workflow guidance, and cross-module workspace assistance |

## AI Assistant Model

Helios treats AI as an application capability, not as an unbounded chat box. Agents and tools are declared with typed contracts, connected to module-owned services, and constrained by the same permission and mutation rules that protect normal user actions.

The intended interaction loop:

1. A user asks Helios to inspect a workflow, customer, catalog item, sales process, or operating issue.
2. The assistant reads scoped platform data through typed tools.
3. It proposes a plan, workflow draft, record update, or next action.
4. Mutating actions are staged as pending actions for review.
5. Approved changes run through guarded platform commands and produce traceable activity.

This keeps AI useful across the platform while preserving reviewability, tenant isolation, and operational accountability.

## Repository Layout

Helios is a Yarn workspace monorepo.

| Path | Responsibility |
|------|----------------|
| `apps/helios` | Main Next.js application: admin workspace, API routes, generated registries, and local runtime |
| `apps/demo` | Static GitHub Pages demo app for the product experience |
| `apps/docs` | Documentation site |
| `packages/core` | Domain modules, platform services, commands, API surfaces, events, and module setup |
| `packages/ai-assistant` | AI agents, tools, chat APIs, UI parts, and assistant runtime contracts |
| `packages/ui` | Shared backend UI, portal UI, tables, forms, and data-call helpers |
| `packages/shared` | Shared types, i18n helpers, DSL utilities, validation helpers, and cross-package primitives |
| `packages/cli` | Helios CLI, generators, migrations, and workspace automation |
| `packages/cache`, `packages/queue`, `packages/events`, `packages/search`, `packages/webhooks`, `packages/scheduler` | Runtime infrastructure packages |
| `packages/enterprise` | Optional enterprise-oriented modules and extension points |
| `external/official-modules` | Optional official module submodule |

## Technology Stack

- **Frontend**: Next.js App Router, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js route handlers, modular service layer, Awilix dependency injection
- **Database**: PostgreSQL with MikroORM
- **Runtime services**: Redis-backed queue and cache packages
- **Search**: optional Meilisearch integration
- **AI**: typed agent/tool runtime with approval-aware mutation flow
- **Tooling**: Yarn 4 workspaces, Turbo, Jest, Playwright, generated registries, project CLI

## Quick Start

### Requirements

- Node.js 24.x
- Yarn 4 through Corepack
- Docker, for local PostgreSQL and Redis

### Install

```bash
git clone git@github.com:Duang777/helios-flow.git
cd helios-flow
corepack enable
corepack prepare yarn@4.17.1 --activate
yarn install
```

### Configure

Create the application environment file:

```bash
cp apps/helios/.env.example apps/helios/.env
```

For local development, update `apps/helios/.env` with database, Redis, JWT, and AI provider settings. If you use the default Docker services, the important values are typically:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/helios
REDIS_URL=redis://localhost:6379
```

### Run

For a fresh local environment with database setup and seed data:

```bash
yarn dev:greenfield
```

For an already-initialized environment:

```bash
yarn dev
```

Open:

- App start: [localhost:3000/start](http://localhost:3000/start)
- Login: [localhost:3000/login](http://localhost:3000/login)
- Backend workspace: [localhost:3000/backend](http://localhost:3000/backend)

Default local accounts seeded by the development setup:

| Role | Email | Password |
|------|-------|----------|
| Superadmin | `superadmin@acme.com` | `secret` |
| Admin | `admin@acme.com` | `secret` |
| Employee | `employee@acme.com` | `secret` |

## Static Demo

Run the demo locally:

```bash
yarn demo:dev
```

Build the demo as a static export:

```bash
yarn demo:build
```

Build it for the deployed GitHub Pages subpath:

```bash
NEXT_PUBLIC_DEMO_BASE_PATH=/helios-landing/demo yarn demo:build
```

The export is written to `apps/demo/out`. The demo app does not require a backend, database, login session, or AI provider key.

## Development Commands

| Command | Description |
|---------|-------------|
| `yarn dev` | Start the main Helios development environment |
| `yarn dev:greenfield` | Initialize and run a clean local development environment |
| `yarn build` | Build packages, generate registries, rebuild packages, and build the app |
| `yarn build:packages` | Build workspace packages |
| `yarn build:app` | Build the main Helios app |
| `yarn generate` | Regenerate module discovery registries |
| `yarn typecheck` | Run workspace type checks |
| `yarn lint` | Run workspace lint checks |
| `yarn test` | Run unit tests |
| `yarn test:integration` | Run Playwright integration tests |
| `yarn db:generate` | Generate database migrations from entity changes |
| `yarn initialize` | Seed or re-seed local defaults |
| `yarn demo:dev` | Start the static demo app |
| `yarn demo:build` | Build the static demo export |
| `yarn docs:dev` | Start the documentation site |
| `yarn agents:check-budget` | Check Codex agent instruction budget constraints |

## Validation

Choose the smallest validation set that matches your change.

Documentation-only changes:

```bash
yarn agents:check-budget
```

Frontend or demo changes:

```bash
yarn lint
yarn typecheck
yarn demo:build
```

Platform or module changes:

```bash
yarn generate
yarn build:packages
yarn typecheck
yarn test
```

Full application changes:

```bash
yarn generate
yarn build:packages
yarn build:app
yarn test
yarn test:integration
```

Before changing public contracts, generated registry surfaces, module IDs, API routes, database schema, event IDs, ACL features, AI tool IDs, or CLI commands, read [BACKWARD_COMPATIBILITY.md](./BACKWARD_COMPATIBILITY.md).

## Local Port Conflicts

`docker compose` reads the repo-root `.env`, while the app reads `apps/helios/.env`. If another project already uses PostgreSQL port `5432` or Redis port `6379`, keep it running and give Helios its own ports.

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

## Documentation

| Document | Purpose |
|----------|---------|
| [AGENTS.md](./AGENTS.md) | Repository-wide engineering rules and task router |
| [BACKWARD_COMPATIBILITY.md](./BACKWARD_COMPATIBILITY.md) | Stable contract and deprecation policy |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution process and expectations |
| [SECURITY.md](./SECURITY.md) | Security policy and reporting process |
| [CHANGELOG.md](./CHANGELOG.md) | Release history |
| [UPGRADE_NOTES.md](./UPGRADE_NOTES.md) | Upgrade and migration notes |
| [SCREENSHOTS.md](./SCREENSHOTS.md) | Visual references |
| [docs/design-system](./docs/design-system) | Design system research, foundations, components, and guardrails |
| [docs/wms/wms-roadmap-and-estimates-en.md](./docs/wms/wms-roadmap-and-estimates-en.md) | WMS roadmap and implementation estimates |

## Contributing

Contributions should preserve tenant isolation, generated registry contracts, module ownership boundaries, and optimistic locking expectations.

Before opening a pull request:

1. Read [AGENTS.md](./AGENTS.md) and the nearest package-level `AGENTS.md`.
2. Keep the change focused and avoid unrelated cleanup.
3. Run the smallest relevant validation set.
4. Document user-facing behavior, public contract changes, migrations, and compatibility notes.
5. Do not commit credentials, private keys, raw tokens, local `.env` files, local build artifacts, or generated demo output.

## Project Status

Helios Flow is an active open-source platform project. The repository contains a working modular application foundation, a static product demo, and ongoing work around workflow AI, governed tool execution, integration depth, and operator-grade administration UX.

Current near-term focus:

- Workflow AI for explaining, drafting, updating, and starting workflow definitions.
- Better review surfaces for AI-proposed mutations.
- Broader AI tool coverage across CRM, sales, catalog, and operating-loop workflows.
- More complete demo datasets and guided product walkthroughs.
- Continued hardening of generated registries, CI validation, and module boundaries.

## Security

Never commit credentials, provider tokens, private keys, local `.env` files, production data, or tenant-specific customer data. Report vulnerabilities through [SECURITY.md](./SECURITY.md).

## License

Helios Flow is released under the MIT License. See [LICENSE](./LICENSE).
