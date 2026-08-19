# Operating Loop Plan (M5 → M6 → M7)

| Field | Value |
|-------|-------|
| Status | draft |
| Date | 2026-08-08 |
| Specs | M5 `.ai/specs/2026-08-07-projects-delivery-module.md` (implemented) · M6 `2026-08-08-commercial-settlement-module.md` · M7 `2026-08-08-insights-kpi-and-governance.md` |

## Closed loop

```text
客户/商机 (customers)                  [AI tools + page inject]
    → 报价/订单 (sales)                [read tools + page inject]
    → 商品查阅 (catalog, read)         [existing tools]
    → 项目/里程碑/风险 (projects)          [M5]
    → 合同→营收/成本→开票→回款核销 (commercial) [M6]
    → KPI 目标与完成率 (insights)           [M7]
    → 治理映射与检出 (governance)           [M7]
    → AI 查询/口径解释/处置建议（确认后写）
```

## Module map

| PRD | Module id | Package path |
|-----|-----------|--------------|
| M5 | `projects` | `packages/core/src/modules/projects/` |
| M6 | `commercial` | `packages/core/src/modules/commercial/` |
| M7 KPI | `insights` | `packages/core/src/modules/insights/` |
| M7 治理 | `governance` | `packages/core/src/modules/governance/` |

## Implementation order (vertical slices)

1. **M6-A** Contract + Invoice + Payment + Allocation + guards + metrics lib/API + CRUD UI  
2. **M6-A+** Revenue/Cost lines + project injection “创建合同”  
3. **M6-B** AI read tools + Playwright  
4. **M7-A** `insights` KPI targets + completion (depends metrics)  
5. **M7-B** `governance` identity maps + findings + core rule pack  
6. **M7-C** AI + optional simulation pack  

Do not start M7-A until `commercial` metrics formulas are unit-tested.

## Platform code norms (all three)

See detailed checklists inside M6/M7 specs. Non-negotiables:

- Plural snake_case module ids; singular event entity segments  
- UUID-only cross-module links; no cross-module ORM  
- `organizationId` + `tenantId` on every row; soft delete; `updatedAt` optimistic lock  
- Commands for writes; `makeCrudRoute` for CRUD; `apiCall` + `CrudForm`/`DataTable`  
- Amounts: `numeric` / `string`, default CNY tax-exclusive  
- i18n en+zh; DS semantic tokens; feature ACL not role names  
- Integration tests self-contained with API fixtures  

## Skills to use when implementing

| Skill | When |
|-------|------|
| `helios-pre-implement-spec` | Before coding each phase |
| `helios-implement-spec` | Execute phase steps |
| `helios-spec-writing` | Spec edits |
| `helios-backend-ui-design` | Backend pages |
| `helios-create-ai-agent` | AI tools/agents |
| `helios-integration-tests` | TC-COM / TC-INS / TC-GOV |
| `helios-ds-guardian` | UI token review |

## Exit criteria (PRD)

| Milestone | Done when |
|-----------|-----------|
| M6 | 可登记合同/营收成本/开票/回款核销；可算开票率、回款率、逾期未回；UI 标明非总账 |
| M7 | 可维护区域 KPI 与完成率（公司派生加总）；去重映射保留源客户；检出含证据 ID；AI 可解释/建议 |

## Open assumptions (confirm before code)

1. M6 = single `commercial` module (not contracts+billing split).  
2. M7 = `insights` + `governance` (two modules).  
3. KPI % targets use **0–100** scale (same spirit as deal win probability).  
4. No `KpiActualOverride` in MVP.  
5. Multi-currency deferred; field present, values CNY.
