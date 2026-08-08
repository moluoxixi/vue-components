# 配置化表单可视化设计器 - Follow-up Implementation Plan

## Scope

The Element Plus designer MVP is already merged. This follow-up is limited to field label layout and zero-layout-cost canvas selection affordances.

## Implementation

- [x] Add optional `labelPosition: 'left' | 'top'` to the versioned form document and strict parser.
- [x] Expose the setting in the form property panel and propagate it through the canvas's recursive node list.
- [x] Render visible labels beside or above the real inert material component.
- [x] Compile the setting into `ConfigFormRenderer` and apply equivalent runtime field layouts.
- [x] Replace permanent node borders and hit-area overlays with a selected-only dashed pseudo-element at `inset: -5px`.
- [x] Position selected-node actions immediately outside the pseudo-element's top-right edge.
- [x] Remove adapter CSS that makes real component text transparent.
- [x] Update unit, compiler, runtime and browser assertions for both label modes and selection geometry.

## Validation

```text
pnpm --filter @moluoxixi/config-form test
pnpm --filter @moluoxixi/config-form typecheck
pnpm --filter @moluoxixi/config-form build
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @moluoxixi/config-form-designer build
pnpm --filter @moluoxixi/config-form-designer-element-plus test
pnpm --filter @moluoxixi/config-form-designer-element-plus typecheck
pnpm -C packages/ConfigForm/playground test:e2e --grep "supports controlled editing, nested movement, history, export/import and preview"
```

Browser verification covers both desktop and mobile widths, visible real component content, the 5px dashed selection outline, toolbar placement and nested drag behavior.

## Rollback

Remove the optional form setting and the selected-state pseudo-element changes together. Existing documents remain compatible because the setting is optional and defaults to `left`.
