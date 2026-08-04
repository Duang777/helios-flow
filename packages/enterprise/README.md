# Helios Enterprise Subscription

The commercial layer of Helios — proprietary enterprise modules plus certification, review, and operational support that take AI-built CRM/ERP systems to production. Delivered as the `@helios/enterprise` package.

## The Problem We Solve

Enterprise clients do not accept production risk.

Open-source or AI-generated systems without certification create concrete concerns around:
- security
- maintainability
- compliance
- long-term support

In serious enterprise environments, "let's deploy and see what happens" is not acceptable.

## Our Position

Uncertified Helios deployments should not go to production.

Production requires:
- enterprise license
- architecture/security audit
- production approval

This is a production requirement.

## The Solution

The Enterprise Subscription answers this directly: run verified builds of Helios on Helios's infrastructure, develop and edit them in the cloud, and let Helios's tooling certify them for production. One subscription bundles the proprietary enterprise modules, the certification path (architecture audit, security / performance / custom-code reviews, homologation), and operational support. It is governed by the Helios Enterprise License Agreement.

## Licensing Model

- **Per project, not per seat.** Charged per Helios project / monorepo, never per developer or end user.
- **Unlimited seats.** No limit on users or servers within a given system.
- **Revenue-based tiers.** The applicable tier is determined by the Licensee's annual revenue, verified against public registry data (e.g. KRS).
- **Usage verification ("Phone Home").** On-premise deployments report aggregate usage counts for transparent billing verification, without Helios needing standing access to your repository.

A *project* is a single business domain / department / goal-oriented deployment of Helios — not limited to a single physical instance (a multi-server deployment can be one project).

## Subscription Tiers

Three tiers scale the level of service with company size. Every tier includes the full Enterprise Software Package and unlimited seats. Commercial terms are provided on request.

| Capability | Basic | Medium | Enterprise |
|---|---|---|---|
| Company revenue band | below $25M | $25M–$250M | above $250M |
| Enterprise software modules (MFA, SSO & Directory Sync, Record Locking) | Included | Included | Included |
| Unlimited users & servers (per project / monorepo) | Included | Included | Included |
| Project sandboxes — *time-limited offer* (dev/staging + prod env, CI/CD, AI SDLC pipeline, 7-day restore) | 1 active project | 3 active projects | 10 active projects |
| Priority support (AI-assisted helpdesk, issue triage) | up to 5 accounts | up to 10 accounts, Discord | unlimited accounts, Discord |
| Support & review coverage | Helios core (open-source) | core + custom code | core + custom code |
| Software updates | self-serve | assisted | managed for you |
| Pre-deployment Architecture Audit | — | Included | Included |
| Monthly Security / Performance / Custom-code Reviews | — | optional | Included |
| Production Approval (Homologation) & go-live recommendation | — | optional | Included |
| Proactive deployment monitoring & lead-application upgrades | — | — | Included |
| Dedicated Customer Success Manager (pre-go-live) | — | optional | Included |
| GDPR documentation & production-config advisory | templates | Included | Included |

Startups below $5M in annual revenue can request a startup discount via [info@helios.com](mailto:info@helios.com).

## Service Detail

**Pre-deployment Architecture Audit.** A structured architecture review before production deployment: overall system architecture, identification of structural risks, and recommendations for production readiness.

**Monthly Security Review (up to 4h/mo).** Application code review, infrastructure and environment configuration review, identification of security risks, and remediation guidance.

**Monthly Performance Review — custom code (up to 4h/mo).** Detection of performance bottlenecks, review of scalability risks, and optimization recommendations.

**Monthly Custom Module Code Review (up to 4h/mo).** Alignment with Helios best practices, code quality and maintainability, agent-friendly architecture patterns, and upgrade safety.

**Priority Technical Support.** Priority helpdesk (Slack / Discord or ticketing) for architecture and development questions, handled with AI assistance within tier limits. Advisory only — it does not include custom software development. Coverage: Basic covers the Helios core (open-source libraries); Medium and Enterprise also cover your custom code.

**Dedicated Customer Success Manager (pre-go-live).** A CSM supports the Product Owner and technical team until launch: one 1-hour online meeting per month, ongoing ticketing support, and rollout-readiness guidance.

**Software Updates.** Security patches, new platform features, and partner-ready upgrade packages with documented risks and upgrade procedures. Basic: update packages are provided and applied by the customer independently. Medium: update packages with support and guidance from our team during the upgrade. Enterprise: managed upgrades — planning, validation, and application by our team. Customers may continue using the software after license expiration, but new updates, security patches, and platform enhancements require an active license.

**Production Approval (Homologation).** A formal production-readiness assessment before go-live: production approval report, risk summary, and go-live recommendation.

**Production Hosting Reference.** A reference self-hosted deployment setup (including Dokploy and parallel queue processing), with an optional fully managed Developer Sandbox Cloud offering for development and testing environments.

## Enterprise Software Package

The `@helios/enterprise` package delivers the proprietary modules included with every subscription — not available in the open-source distribution:

- **MFA / 2FA** — multi-factor authentication with pluggable providers (TOTP, WebAuthn/passkeys, OTP email), enforcement policies, sudo challenge flows, provider-specific challenge UI registry, and enrollment redirect UX
- **SSO & Directory Sync** — SAML/OIDC single sign-on with SCIM directory provisioning, per-org IdP configuration, and JIT user provisioning
- **Record Locking** — optimistic and pessimistic mutation protection with participant presence, conflict detection/resolution, and force release
- **Auth Login Interceptors** — MFA login gating via UMES extension points with zero core modifications
- **System Status Overlays** — enterprise overlays and injected widgets for system status pages

## Sandboxes

Helios Sandboxes are pre-provisioned cloud environments with Helios (in dev mode) and AI coding agents preinstalled — ready in about 30 seconds, no local setup. Start from a ready-made template (e.g. a CRM app) or an empty project, and you get a real, production-grade stack to build on (RBAC, encryption, multi-tenancy) on an industry-standard toolchain, so skills transfer to real work — no proprietary lock-in.

- A browser workspace: a terminal with your coding agents (Claude Code, Codex) one pick away and a live preview, plus an IDE-with-chat view.
- Full GitHub integration and live previews you can share by URL.
- Pause, resume, or delete sandboxes; state persists, with backups and restore up to 7 days back.

Build and learn in the sandbox, then move the application to your own infrastructure. This unified trial-and-build path replaces ad-hoc demos — start immediately, without first clearing a security review.

Within the Enterprise Subscription, project sandboxes are included as a time-limited offer. Sandboxes are for building and learning; production still runs the certification and homologation path above.

More detail: [Sandboxes spec](../../.ai/specs/enterprise/Sandboxes.md) · pre-launch waitlist: [sandboxes.helios.com](https://sandboxes.helios.com)

## Helios Partnership Program

Build Helios implementations without production risk.

Helios takes responsibility for platform standards, security, and production certification. Partner agencies own delivery, revenue, and the client relationship.

## Helios Certified Agencies

Certified agencies serve clients with an Helios license. This supports ecosystem quality and enables deeper go-to-market collaboration.

Certified partners receive:
- Official Certified Helios Agency status
- Ability to deliver production-ready Helios projects
- Qualified leads from Helios (when available)
- Joint enterprise sales narrative support (including case-study/media collaboration)
- Support in winning key clients
- Access to platform expertise and standards

## Roles and Responsibilities

Helios acts as:
- owner of the platform standard
- license provider
- certification authority
- ecosystem enabler

Helios does not deliver client projects and does not compete with partners.

Partner agency is responsible for:
- project delivery
- client relationship
- customization and development
- project-level support

Agencies operate on the front line; Helios stands behind system quality.

## Financial Model

- Delivery: handled by the partner agency.
- Platform and enterprise license: provided by Helios.
- Helios sells the platform license directly to the client.
- Agency owns project delivery revenue, client relationship, and ongoing services revenue.
- If Helios provides the lead, commission terms apply under partner agreement.

## Contact

- Enterprise licensing and program details: [info@helios.com](mailto:info@helios.com)
- Certified agency partnership: [mat@helios.com](mailto:mat@helios.com)

## Important

- This package does not represent the complete Enterprise Edition offering.
- Enterprise Edition includes implementation standards, certification workflow, and partner support layers beyond code features.
