# 配置化表单可视化设计器 - Implementation Plan

## Delivery Shape

Implement in the worktree `D:\project-new\vue-component.worktrees\visual-form-designer` on branch `codex/visual-form-designer`.

The work is additive and should land in this order:

1. `@moluoxixi/zod3-to-rule` standalone rules package.
2. Designer document, registry, compiler and command/history core.
3. Adapter-neutral designer shell and interaction primitives.
4. Element Plus material/setter adapter.
5. ConfigForm playground integration and browser verification.

Do not start implementation until the planning artifacts are reviewed and the task is activated with `task.py start`.

## Phase 1: Rules Package

Files/ownership:

- `packages/zod3-to-rule/**`
- package manifest, Vite build config, public barrel and tests

Checklist:

- [x] Define versioned JSON-safe rule descriptor types and discriminated unions.
- [x] Add strict input parsing/normalization and `RuleDiagnostic` projection.
- [x] Implement deterministic `rulesToZod` for the MVP rule set.
- [x] Implement `zodToRules` for an explicitly supported Zod 3 subset.
- [x] Isolate any Zod 3 internal inspection behind a version-specific module; never expose `_def` in public output.
- [x] Return diagnostics for custom/refine/transform/preprocess/async or otherwise lossy schemas.
- [x] Add JSON round-trip, compile behavior, unsupported-node and malformed-input tests.

Validation gate:

```text
pnpm --filter @moluoxixi/zod3-to-rule test
pnpm --filter @moluoxixi/zod3-to-rule typecheck
pnpm --filter @moluoxixi/zod3-to-rule build
```

Rollback point: remove the new package; no ConfigForm runtime package should import it yet.

## Phase 2: Designer Core

Files/ownership:

- `packages/ConfigForm/designer/src/document/**`
- `packages/ConfigForm/designer/src/registry/**`
- `packages/ConfigForm/designer/src/compiler/**`
- `packages/ConfigForm/designer/src/history/**`
- public types, package manifest and focused tests

Checklist:

- [x] Define `DesignerDocument` version 1 with stable node IDs and JSON-only fields.
- [x] Implement document parser, adjacent migrations, normalization and semantic validation.
- [x] Define material, setter, slot and extension registry contracts with deterministic precedence.
- [x] Define condition AST and compiler for the supported operators.
- [x] Delegate validation compilation to `@moluoxixi/zod3-to-rule`.
- [x] Compile material keys/bindings to `ConfigFormRendererNode[]` without mutating the document.
- [x] Implement command reducer for add/move/copy/remove/update/replace.
- [x] Reject duplicate IDs, duplicate field keys, cycles, invalid slot targets and unknown registry keys.
- [x] Implement bounded snapshot history and controlled document synchronization.

Validation gate:

```text
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @moluoxixi/config-form-designer build
```

Rollback point: the package may remain unpublished and unused; existing `ConfigForm` exports must be byte-for-byte behaviorally unchanged.

## Phase 3: Designer Shell

Files/ownership:

- `packages/ConfigForm/designer/src/components/**`
- `packages/ConfigForm/designer/src/composables/**`
- designer styles and component tests

Checklist:

- [x] Build the three-pane workbench: palette, canvas and property panel.
- [x] Make selection, focus restoration and empty-slot drop zones stable by node ID.
- [x] Wire pointer drag and keyboard move commands to the same reducer.
- [x] Implement toolbar commands: undo, redo, preview, import and export.
- [x] Implement mixed property commit semantics from the PRD.
- [x] Render structured diagnostics at document, node and property paths.
- [x] Keep host document controlled and emit semantic change events.

Validation gate:

```text
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
```

Rollback point: disable the playground route and remove the designer entry; no runtime behavior changes.

## Phase 4: Element Plus Adapter

Files/ownership:

- `packages/ConfigForm/designer-element-plus/**`
- Element Plus material definitions and setter components/tests

Checklist:

- [x] Register the agreed common fields: input, textarea, input-number, select, radio, checkbox, switch, date and time.
- [x] Register finite containers: section/card, tabs/tab-pane and collapse/collapse-item with legal slots.
- [x] Supply default nodes, labels, binding metadata, option editor and layout setter definitions.
- [x] Keep Element Plus and Vue as peer dependencies and Rollup externals.
- [x] Verify unknown/duplicate registration behavior and adapter-local overrides.

Validation gate:

```text
pnpm --filter @moluoxixi/config-form-designer-element-plus test
pnpm --filter @moluoxixi/config-form-designer-element-plus typecheck
pnpm --filter @moluoxixi/config-form-designer-element-plus build
```

Rollback point: remove only the adapter package; the core designer remains usable with a host-supplied registry.

## Phase 5: Playground Integration And E2E

Files/ownership:

- `packages/ConfigForm/playground/src/examples/**`
- `packages/ConfigForm/playground/e2e/**`
- playground package config only when required

Checklist:

- [x] Add a designer example using the Element Plus adapter.
- [x] Demonstrate controlled document export/import and real ConfigForm renderer preview.
- [x] Cover palette add, same-level reorder, cross-container move, copy/delete and invalid drop across reducer/component coverage and the browser flow.
- [x] Cover property edit, declaration rules, Zod error display and custom registry diagnostics across compiler/runtime coverage and the browser flow.
- [x] Cover undo/redo, keyboard movement and browser focus restoration.
- [x] Preserve the existing 200-field render/edit/submit baseline; a dedicated 200-node designer performance benchmark is deferred beyond the MVP.

## MVP Verification Notes

The core MVP is complete. The final gates passed from the worktree root: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e:config-form` (12 Playwright tests). The remaining broader runtime interaction matrix and a dedicated 200-node designer benchmark are post-MVP expansion tests, not blockers for the agreed core scope.

Validation gate:

```text
pnpm --filter @moluoxixi/config-form-playground test:e2e
pnpm test:e2e:config-form
```

Rollback point: remove the designer example and E2E spec while leaving the existing playground examples intact.

## Final Quality Gate

Run from the worktree root:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e:config-form
```

Also run the project `check` workflow against the diff and a cross-layer review covering:

- one owner for document parsing/normalization/diagnostics;
- no renderer-local redefinition of designer or rules payloads;
- all public barrels, exports, peer dependencies and Rollup externals;
- JSON round-trip and runtime preview equivalence;
- existing ConfigForm tests and generated docs unaffected.

## Risk Register

| Risk | Mitigation | Detection |
|---|---|---|
| SortableJS DOM and Vue tree race | DOM is transient; reducer is final source of truth | nested drag E2E + reducer tests |
| Zod exporter relies on private internals | isolate adapter, pin Zod 3 peer, diagnostics for unsupported nodes | rules package compatibility tests |
| Property edits pollute history | commit boundaries and compound Apply/Cancel | history unit tests |
| Component registry drift | versioned material definitions and duplicate-key checks | registry contract tests |
| Runtime schema divergence | compiler snapshot tests against renderer inputs | export/import preview E2E |
| Large document editing cost | bounded snapshots first, profile before patches | 200-node benchmark |
