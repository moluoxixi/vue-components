# @moluoxixi/components

## 0.3.0

### Minor Changes

- 1d741fb: Add responsive CSS widths and a configurable column pane with drag ordering, visibility toggles, and width controls to ConfigTable.
- dedd859: Add selector overloads for row and cell table mode APIs, and wait for documentation styles before mounting the VitePress app.

### Patch Changes

- Updated dependencies
  - @moluoxixi/config-form@0.2.3
  - @moluoxixi/rich-text-editor@0.1.2
  - @moluoxixi/config-form-headless@0.2.3

## 0.2.3

### Patch Changes

- Automatically release packages changed in 2c31e9a8f75f.
- Updated dependencies
  - @moluoxixi/config-form@0.2.2
  - @moluoxixi/config-form-headless@0.2.2
  - @moluoxixi/hooks@0.2.1
  - @moluoxixi/rich-text-editor@0.1.1

## 0.2.2

### Patch Changes

- Updated dependencies
  - @moluoxixi/config-form@0.2.1
  - @moluoxixi/config-form-headless@0.2.1

## 0.2.1

### Patch Changes

- Automatically release packages changed in f3406e91d0a8.

## 0.2.0

### Minor Changes

- abc4b8c: Expose automatic component and runtime import presets from the isolated
  `@moluoxixi/components/auto-loaders` subpath. The subpath does not load the
  component root barrel or expose unplugin types from its public declarations.
- e11fc22: Expand `@moluoxixi/config-form-headless` into the shared Vue headless light-form kernel with required/Zod/custom validation, normalized errors, stale-safe async validation and submit snapshots, dynamic reset defaults, readonly, and readonlyRender. Add a shared Vue DOM renderer at `@moluoxixi/config-form/renderer` for native form, Grid/Flex, recursive nodes, field shells, ARIA, binding presets, and controlled expose APIs while retaining the root Runtime/Plugin route for schema and UI plugins. Move the standalone Element Plus, Ant Design Vue, and `@moluoxixi/components` ConfigForm implementations to thin adapters over that renderer, without UI-library Form/FormItem/Row/Col components. Add `@moluoxixi/config-form-designer-antd-vue` as an independent visual-designer adapter with real Ant Design Vue materials, option resolution, default-value controls, readonly rendering, responsive layouts, localized setters, and password/search/autocomplete/slider/rate fields. Make designer selection outlines track the actual rendered component with a 5px measured expansion instead of the full grid cell. Rename DOM passthrough APIs to `formAttrs`, `layoutAttrs`, `cellAttrs`, and `fieldAttrs`, including their public adapter type aliases, and deprecate the generic `withInstall` export from headless. Track reset-baseline dirty/touched metadata independently from `validateOn`, expose it through `metaChange`, slot `meta`, `getMeta`, `getFieldMeta`, and `setTouched`, and add `data-dirty` / `data-touched` hooks to renderer form and field DOM. Breaking: remove the unsupported `@moluoxixi/config-form-shadcn-vue` and `@moluoxixi/config-form-plugin-shadcn-vue` packages in favor of adapters backed by stable upstream Vue component contracts.
- db691ca: Switch ConfigTable to Element Plus TableV2 and add explicit virtual table sizing props.
- 134f5fa: Add `CopyText`, headless `HeadlessCopyText`, the `copyText` clipboard utility, and the Tiptap-based `RichTextEditor` with HTML v-model, formatting controls, custom toolbar support, and accessible disabled and readonly states.
- 498fd4b: Expand HeadlessTable with stable column identities and accessors, scoped renderer registries, configuration diagnostics, corrected formatter precedence, and the controlled `useHeadlessTable` state composable for sorting, filtering, pagination, selection, and column state.
- f70ab2d: Add request-cached hooks and request-aware option/table components.

### Patch Changes

- Updated dependencies [e11fc22]
- Updated dependencies [f70ab2d]
  - @moluoxixi/config-form@0.2.0
  - @moluoxixi/config-form-headless@0.2.0
  - @moluoxixi/hooks@0.2.0
