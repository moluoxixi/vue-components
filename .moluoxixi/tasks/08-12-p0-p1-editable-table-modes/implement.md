# Implementation Plan

1. Load frontend and reuse guidelines; baseline affected tests and package manifests.
2. Add the shared table mode types/state helper with unit tests for precedence, clear behavior, and stable ids.
3. Extend HeadlessTable props, expose, cell scopes, inline/named `edit` slots, and renderer fallback tests.
4. Implement the same contract in ConfigTable, add stable `getRowId` support, expose APIs, and cover table/row/cell edit-slot selection.
5. Extract `useRequestTableComponent`; migrate ConfigTable and PopoverTableSelect while preserving their policy differences and tests.
6. Publicly export and directly test `useRequestOptionsComponent` without conflicting with `@moluoxixi/hooks/useRequestOptions`.
7. Add `useClipboardCopy`; refactor HeadlessCopyText and cover state/reset/unmount/error behavior.
8. Extract `@moluoxixi/rich-text-editor`; retain components compatibility exports, update build/config/docs/playground/tests, and update the lockfile.
9. Consolidate ConfigForm designer option resolver lifecycle and pass same-operation reaction projections through controller validation paths; add regression tests.
10. Add Turbo task graph and migrate root scripts without losing docs or ConfigForm verification coverage.
11. Add packed-package validation, declaration/import consumer smoke checks, and workflow semantic linting.
12. Add Chromium browser CI with path/main policy and failure artifacts; update workflow topology tests.
13. Run focused tests after each slice, then full affected lint, typecheck, unit tests, build, package validation, and browser tests.
14. Run the project `check` workflow, repair findings, audit spec proposals, and prepare a user-reviewed commit plan.
15. Add direct request-table bridge tests and stabilize the EnterNextContainer E2E test using ARIA state synchronization.
16. Add bulk table mode cleanup APIs plus typed mode-change events to HeadlessTable and ConfigTable; update tests and bilingual docs.
17. Refactor packed-entry discovery into testable helpers, add release behavior tests, and add a Vite/Chromium packed browser consumer smoke.
18. Submit editable-table component and quality contracts as pending spec proposals, rerun the full quality gate, and commit P2/P3 separately from the P0/P1 baseline.

## Validation Commands

```text
pnpm --filter @moluoxixi/components test
pnpm --filter @moluoxixi/config-form-headless test
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer-element-plus test
pnpm --filter @moluoxixi/config-form-designer-antd-vue test
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm test:pack
pnpm lint:workflows
pnpm test:release
pnpm test:e2e
```

## Risk Gates

- Verify current renderer precedence before and after edit-slot work.
- Verify ConfigTable never uses generated row indexes for persisted mode overrides.
- Verify packed legacy and new RichTextEditor imports resolve under NodeNext.
- Verify Turbo does not cache release publishing or stale generated documentation artifacts.
- Verify no ConfigForm projection is reused across external model or field-tree changes.
