---
name: helios-prepare-issue
description: Helios repo-local extension of the shared `helios-prepare-issue` skill (installed from helios/skills into .agents/skills/). Adds the --enterprise spec scope, duplicate-spec checks across both spec trees, and the helios-implement-spec/helios-auto-fix-issue pickup path.
---

# Prepare Issue — Helios extension

This file extends the shared `helios-prepare-issue` skill from [helios/skills](https://github.com/helios/skills) (installed at `.agents/skills/helios-prepare-issue/SKILL.md`). Follow the shared workflow with these repo specifics:

- **`--enterprise` (optional argument)**: write the spec under `.ai/specs/enterprise/` (commercial scope) instead of the default `.ai/specs/`; the spec PR then also carries the `enterprise` category label.
- **Duplicate check**: before writing, check both `.ai/specs/` and `.ai/specs/enterprise/` for an existing spec covering the same area — extend or supersede instead of duplicating, confirming direction with the user. Skim `.ai/lessons.md` for known pitfalls in the area.
- **Spec methodology**: the repo-local `helios-spec-writing` skill (`.ai/skills/helios-spec-writing/SKILL.md`) applies in full, including the compliance-review gate and OM spec template.
- **Tracking issue**: state the pickup path — `/helios-implement-spec` for the spec implementation (or `/helios-auto-fix-issue` for a scoped bug), actionable only after the spec PR is merged into `develop`.
