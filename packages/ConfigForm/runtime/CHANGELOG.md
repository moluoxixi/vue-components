# @moluoxixi/config-form

## 0.2.2

### Patch Changes

- Automatically release packages changed in 2c31e9a8f75f.
- Updated dependencies
  - @moluoxixi/config-form-headless@0.2.2

## 0.2.1

### Patch Changes

- Automatically release packages changed in 018d8653e054.
- Updated dependencies
  - @moluoxixi/config-form-headless@0.2.1

## 0.2.0

### Minor Changes

- e11fc22: Expand `@moluoxixi/config-form-headless` into the shared Vue headless light-form kernel with required/Zod/custom validation, normalized errors, stale-safe async validation and submit snapshots, dynamic reset defaults, readonly, and readonlyRender. Add a shared Vue DOM renderer at `@moluoxixi/config-form/renderer` for native form, Grid/Flex, recursive nodes, field shells, ARIA, binding presets, and controlled expose APIs while retaining the root Runtime/Plugin route for schema and UI plugins. Move the standalone Element Plus, Ant Design Vue, and `@moluoxixi/components` ConfigForm implementations to thin adapters over that renderer, without UI-library Form/FormItem/Row/Col components. Add `@moluoxixi/config-form-designer-antd-vue` as an independent visual-designer adapter with real Ant Design Vue materials, option resolution, default-value controls, readonly rendering, responsive layouts, localized setters, and password/search/autocomplete/slider/rate fields. Make designer selection outlines track the actual rendered component with a 5px measured expansion instead of the full grid cell. Rename DOM passthrough APIs to `formAttrs`, `layoutAttrs`, `cellAttrs`, and `fieldAttrs`, including their public adapter type aliases, and deprecate the generic `withInstall` export from headless. Track reset-baseline dirty/touched metadata independently from `validateOn`, expose it through `metaChange`, slot `meta`, `getMeta`, `getFieldMeta`, and `setTouched`, and add `data-dirty` / `data-touched` hooks to renderer form and field DOM. Breaking: remove the unsupported `@moluoxixi/config-form-shadcn-vue` and `@moluoxixi/config-form-plugin-shadcn-vue` packages in favor of adapters backed by stable upstream Vue component contracts.

### Patch Changes

- Updated dependencies [e11fc22]
  - @moluoxixi/config-form-headless@0.2.0

## 0.1.1

### Patch Changes

- 1035d60: Move devtools source-id DOM attribute injection into the Vite plugin adapter and add page-based field/component picking to the browser overlay.
