# P0 P1 architecture and editable table modes

## Goal

Complete the previously identified P0/P1 architecture work and extend the table stack with a compatible, API-driven display/edit mode system and richer slots.

The outcome should reduce duplicated request and adapter logic, strengthen build/release verification, isolate heavyweight editor dependencies, and let consumers switch an entire table, a row, or a cell between `default` and `edit` without replacing the table implementation.

## Background

- `RequestSelectV2`, `RequestTreeSelect`, and `RequestCascader` already share a private request-options bridge.
- `ConfigTable` and `PopoverTableSelect` duplicate their `useRequestTable` component bridge.
- `HeadlessCopyText` owns a reusable clipboard state machine that is not available as a composable.
- `@moluoxixi/components` currently owns the complete Tiptap-based rich-text editor and its heavyweight runtime dependencies.
- ConfigForm's Element Plus and Ant Design Vue designer adapters duplicate option resolver lifecycle code.
- Root CI repeats package builds across typecheck, test, coverage, and build, while existing browser suites are not part of CI.
- Published packages have complex export maps, but release checks do not consistently validate packed artifacts and declaration resolution.
- The table stack currently has no unified global/row/cell display-edit mode contract.

## Requirements

### Request and component reuse

- R1. Expose a stable public request-options composable for custom option renderers while preserving existing Request* component behavior.
- R2. Share the component-facing `useRequestTable` bridge between `ConfigTable` and `PopoverTableSelect` without erasing their intentional pagination/default differences.
- R3. Expose a reusable clipboard-copy composable and implement `HeadlessCopyText` on top of it without breaking the current component API.

### Table modes and slots

- R4. Support exactly two initial table modes: `default` and `edit`; the default effective mode is `default`.
- R5. Support global, row, and cell mode overrides. Effective mode precedence is cell override, then row override, then global mode, then `default`.
- R6. Only the global/table mode is controllable through component props. A `mode="edit"` prop switches the entire table to edit rendering. Global/table, row, and cell modes must all be switchable through the exposed API.
- R7. The API must support setting and clearing global, row, and cell overrides and reading the effective mode for a row or cell.
- R8. Row and cell overrides must use the table's stable row identity contract rather than array position.
- R9. Mode state changes must remain reactive and must not mutate row data.
- R10. Add an edit cell slot contract alongside the existing default cell slot contract. When a cell's effective mode is `edit`, its edit slot is selected; table-level edit mode selects edit slots for all cells, row-level edit mode selects them for that row, and cell-level edit mode selects one cell.
- R10a. Both inline column edit slots and named edit slot references must be supported consistently with the existing default-slot mechanisms.
- R10b. Slot scopes must expose effective mode, stable row identity, row/column context, and scoped mode actions. Consumers own all trigger controls, editing UI, save/cancel behavior, validation, and row-data updates.
- R11. Existing consumers that do not supply `mode` or call mode APIs must render exactly as before.

### Package boundaries

- R12. Extract RichTextEditor into a focused publishable package, keep a compatibility re-export from `@moluoxixi/components`, and prevent unrelated components consumers from requiring Tiptap at runtime.
- R13. Preserve existing RichTextEditor component names, props, events, slots, styles, and documentation links through the compatibility surface.

### ConfigForm

- R14. Move duplicated designer option resolver lifecycle behavior into the shared designer layer while retaining framework-specific injection keys, aliases, and diagnostics contracts.
- R15. Reuse a reaction projection within the same synchronous controller operation where correctness permits; do not cache it across external field/model changes.
- R16. Do not merge public Element Plus and Ant Design Vue adapter packages.

### Tooling and CI

- R17. Introduce task-graph caching for build, typecheck, test, and coverage, with release builds forced fresh and all cross-package/generated inputs declared.
- R18. Add browser test coverage to CI with an intentional PR/main/nightly policy and diagnostic artifacts for failures.
- R19. Add publishable-package validation using packed artifacts, export/declaration checks, and a consumer import/type smoke test.
- R20. Add semantic GitHub Actions validation while retaining repository-specific release workflow tests.
- R21. Add direct contract tests for the shared request-table bridge instead of relying only on its two component consumers.
- R22. Add bulk mode cleanup APIs and additive mode-change notifications without turning the `mode` prop into a v-model contract.
- R23. Stabilize the existing EnterNextContainer browser test against Element Plus overlay transitions using observable ARIA state.
- R24. Add fast behavior tests for publish-package entry discovery and a Vite browser-consumer smoke for browser-capable public subpaths and stylesheet entries.
- R25. Capture the reusable editable-table component and regression contracts as reviewable frontend spec proposals.
- R26. Replace package-depth-dependent declaration postbuild paths and high-value cross-module component imports with explicit, tool-supported root aliases while preserving build and declaration behavior.

## Constraints

- Public API changes must be additive or retain compatibility re-exports.
- Mode resolution and edit-slot selection belong in the headless table contract; UI-specific triggers and edit controls remain consumer-defined through slots.
- An `edit` mode indicates rendering intent and context. It does not introduce a form engine, persistence protocol, validation engine, or automatic row mutation.
- Existing active tasks `08-08-config-form-designer-advanced` and `08-03-vitepress-component-docs` must not have their unrelated in-progress changes overwritten.
- No package publication, push, or task archival is authorized by this task.

## Acceptance Criteria

- [ ] AC1. Existing Request* tests pass and a custom consumer can use the public request-options composable with reactive params, loading, error, refetch, and loaded/error callbacks.
- [ ] AC2. `ConfigTable` and `PopoverTableSelect` use one shared request-table bridge, with regression tests covering their distinct pagination/reset defaults.
- [ ] AC3. `useClipboardCopy` is public, tested for success/failure/reset/unmount behavior, and `HeadlessCopyText` remains API-compatible.
- [ ] AC4. A table starts in `default`; global prop/API, row API, and cell API changes resolve with `cell > row > global > default` precedence.
- [ ] AC5. Clearing a cell or row override reveals the next effective mode, and clearing global mode returns to the prop value or `default` according to the finalized controlled-state contract.
- [ ] AC6. A cell in `edit` selects its inline or named edit slot; without an edit slot it falls back to the unchanged default renderer chain. Table, row, and cell API changes affect exactly the requested scope.
- [ ] AC6a. Edit slot contexts expose effective mode, stable row identity, row/column context, and scoped mode actions without breaking existing default/header slots.
- [ ] AC7. Row reorder/filter/pagination does not attach overrides to the wrong row.
- [ ] AC8. RichTextEditor can be imported from its new package and from the legacy components subpath; non-editor component entrypoints do not import Tiptap.
- [ ] AC9. Shared ConfigForm option resolver lifecycle tests pass for both UI adapters, and reaction behavior remains unchanged while redundant same-operation projection work is removed.
- [ ] AC10. CI task caching is deterministic, browser suites are scheduled as designed, and release jobs bypass stale build caches.
- [ ] AC11. Packed publishable packages pass manifest/export/type/consumer smoke checks; GitHub Actions pass semantic validation.
- [ ] AC12. Affected package unit tests, typechecks, lint, build, browser tests, and release workflow tests pass.
- [ ] AC13. `clearAllRowModes`, `clearAllCellModes`, and `clearAllModes` remove only their documented override scopes and emit one typed `modeChange` notification per effective API mutation.
- [ ] AC14. The request-table bridge has direct query/static/error/pagination tests, and the EnterNextContainer browser test waits on its ARIA contract rather than overlay timing.
- [ ] AC15. Publish-package entry discovery has fast unit coverage, while a Vite consumer build and Chromium smoke exercise explicitly browser-capable packed subpaths and styles.
- [ ] AC16. Editable-table API and quality contracts are submitted as pending proposals without directly changing approved specs.
- [ ] AC17. Packages that finalize declarations use one root command with an explicit package manifest, and components source aliases resolve consistently in TypeScript, Vite, tests, and emitted declarations.

## Out of Scope

- Built-in edit triggers or editable-cell UI, automatic input selection, dirty tracking, validation, persistence, or save/cancel workflow.
- New generic `RemoteSelect`, a third ConfigForm facade, or an additional date-picker component.
- Nx migration, package publication, or removal of compatibility exports.


## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
