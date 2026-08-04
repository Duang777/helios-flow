---
name: helios-auto-create-pr-loop
description: Helios repo-local extension of the shared `helios-auto-create-pr-loop` skill (installed from helios/skills into .agents/skills/). Pins the spec-completion gates (OM integration suites + helios-ds-guardian) and the .ai/specs/enterprise spec scope.
---

# Auto Create PR Loop — Helios extension

This file extends the shared `helios-auto-create-pr-loop` skill from [helios/skills](https://github.com/helios/skills) (installed at `.agents/skills/helios-auto-create-pr-loop/SKILL.md`). Follow the shared workflow with these repo specifics:

- **Spec sources**: work may be driven by a file under `.ai/specs/` or `.ai/specs/enterprise/` (enterprise scope). The run-folder contract is documented in `.ai/runs/README.md`.
- **Spec-completion gates**: "the repo's integration suite" means `yarn test:integration` (Playwright; see the `helios-integration-tests` skill for ephemeral modes) plus `yarn test:create-app:integration` when the change touches template-synced surfaces. "Any style-compliance pass" means running the `helios-ds-guardian` skill when UI was touched.
- **Checkpoint artifacts**: browser-automation transcripts are Playwright transcripts (`playwright.log`) per the OM QA setup.
- **Validation runner**: pick Docker vs local per root `AGENTS.md` § Validation Commands before running the gate.
