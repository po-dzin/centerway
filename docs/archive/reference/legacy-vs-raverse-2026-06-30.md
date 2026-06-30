# Legacy vs RAverse Map

Date: 2026-06-30  
Purpose: compare `docs/legacy/**` with the current canonical layer in
`/Users/G/Documents/RAverse/ReOS/Projects/CenterWay`.

## Conclusion

Most legacy material is no longer an active source of truth. Its content now falls into
four categories:

1. already absorbed by RAverse canon;
2. useful only as historical provenance;
3. wave-specific local ops notes that belong in archive, not canon;
4. migration-era operational material superseded by current runtime and SQL records.

Legacy should therefore remain a provenance reservoir, not an active design or product
authority.

## Legacy Layout After Compression

- `docs/legacy/brand/`
- `docs/legacy/ui-system/`
- `docs/legacy/architecture/`
- `docs/legacy/admin/`
- `docs/legacy/product/`
- `docs/legacy/quality/`
- `docs/legacy/migration/`
- `docs/legacy/local-ops/`

This folder split is organizational only. It does not restore any legacy authority.

## Current RAverse Authorities

- brand and claims: `Бренд-контракт.md`, `Брендбук.md`, `Семиотический паспорт.md`
- UI and semantic structure: `UI-UX канон.md`, `Блоки и компоненты.md`, `Лендинги.md`
- tokens and generator logic: `Дизайн-токены.md`, `Генератор экранов.md`
- architecture and admin: `Архитектура.md`, `Админка.md`
- dosha-test: `Доша-тест.md`
- migration and release: `Миграция и SQL.md`, `Релизный чеклист.md`
- registry and governance: `CenterWay.md`, `Реестр.md`, `Мета-аудит.md`

## Legacy Coverage Map

### Brand / semiotics

Covered by RAverse:

- `docs/legacy/brand/BRAND.md`
- `docs/legacy/brand/SDB_wellness_edu_ecosystem.md`
- `docs/legacy/brand/centerway_brand_ssot_v1.md`
- `docs/legacy/brand/centerway_brand_style_hardening_v1_2.md`
- `docs/legacy/brand/centerway_semiotic_brand_research.md`
- `docs/legacy/brand/centerway_universal_brand_system_passport_filled_v_0_1.md`

Current authority:

- `Бренд-контракт.md`
- `Брендбук.md`
- `Семиотический паспорт.md`
- `CenterWay.md`

Disposition:

- keep in legacy for provenance only

### UI / blocks / components / design tokens

Covered by RAverse:

- `docs/legacy/ui-system/centerway_ui_ux_canon_v_0_1.md`
- `docs/legacy/ui-system/centerway_component_canon_matrix_v_0_1.md`
- `docs/legacy/ui-system/centerway_semantic_block_library_v_0_1.md`
- `docs/legacy/ui-system/centerway_generator_token_schema_v_0_1.md`
- `docs/legacy/ui-system/centerway_parametric_ui_generator_spec_v_0_1.md`
- `docs/legacy/brand/centerway_brand_design_tokens_foundation.md`
- `docs/legacy/ui-system/centerway_material_depth_spec_v_0_1.md`
- `docs/legacy/ui-system/centerway_screen_assembly_spec_v_0_1.md`
- `docs/legacy/product/centerway_landing_contract_consult_v1.md`
- `docs/legacy/product/landing-short-irem-baseline.md`
- `docs/legacy/product/landing-short-irem-ds-gaps.md`

Current authority:

- `UI-UX канон.md`
- `Блоки и компоненты.md`
- `Дизайн-токены.md`
- `Генератор экранов.md`
- `Лендинги.md`

Disposition:

- treat as historical design development artifacts
- route-specific derivatives should live in `docs/archive/reference/`, not in active root

### Architecture / admin / system shape

Covered by RAverse:

- `docs/legacy/architecture/center_way_architecture_frame.md`
- `docs/legacy/architecture/centerway_control_panel_arch_build_algorithm.md`
- `docs/legacy/architecture/centerway_system_passport.md`
- `docs/legacy/admin/centerway_admin_passport.md`
- `docs/legacy/admin/admin_ui_governance_contract.md`

Current authority:

- `Архитектура.md`
- `Админка.md`
- `CenterWay.md`
- `Реестр.md`

Disposition:

- keep as origin/history docs only

### Dosha-test

Covered by RAverse:

- `docs/legacy/product/center_way_dosha_test_spec_agent_ready.md`
- `docs/legacy/product/dosha_test_ui_contract_v1.md`

Current authority:

- `Доша-тест.md`

Disposition:

- keep only as provenance snapshots

### Migration / release / quality gates

Covered by RAverse:

- `docs/legacy/quality/centerway_ship_checklist_v1.md`
- `docs/legacy/quality/meta_audit_yws_vs_centerway_v1.md`
- `docs/legacy/migration/API_CONTRACTS.md`
- `docs/legacy/migration/CUTOVER_CHECKLIST.md`
- `docs/legacy/migration/FLOW_TEST_MATRIX.md`
- `docs/legacy/migration/MONOREPO_CUTOVER_PLAN.md`
- `docs/legacy/migration/PARAMETRIC_REVORK_V1.md`
- `docs/legacy/migration/ROUTE_MAPPING.md`

Current authority:

- `Релизный чеклист.md`
- `Мета-аудит.md`
- `Миграция и SQL.md`

Disposition:

- migration docs are historical unless a specific recovery task needs them

### Legacy local ops subtree

Files under `docs/legacy/local-ops/**` are superseded by the current local archive model.

Current local authority:

- `docs/LOCAL_DOCS.md`
- `docs/archive/working-notes/`
- `docs/archive/ops/`

Disposition:

- keep for provenance only
- do not revive them into active root docs

## Practical Rule After This Review

- use RAverse for active semantic, UX, architecture, product, and governance decisions
- use `docs/` root only for repo-local operating entry points
- use `docs/archive/**` for local evidence that should remain searchable
- use `docs/legacy/**` only when reconstructing an old decision or auditing drift
