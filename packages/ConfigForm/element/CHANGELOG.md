# @moluoxixi/config-form-element

## 0.3.1

### Patch Changes

- Automatically release packages changed in 9162cfa5eb38.
- Updated dependencies
  - @moluoxixi/config-form@0.3.1
  - @moluoxixi/config-form-headless@0.3.1

## 0.3.0

### Minor Changes

- 9d21019: 完成 ConfigForm Studio 的本地 Demo 创作主链：项目与 Surface/Dataset/Resource 资产、
  主题和业务物料、字段 Required、声明式状态和值联动、Page/Dialog/Drawer 原型交互，
  以及 Design/Experience 和源码导出均使用同一套严格 JSON-safe 合同。

  Dataset 引用新增结构化 filter/sort/page query，ProjectDocument、SurfaceGraph、Canonical
  IR 与 Compiler 分别硬切到 8、3、7 和 8.0.0；旧、未来、缺失和混合版本不兼容读取。

- 9772a58: Surface Foundation 将 ConfigForm 的持久化、编译和运行身份切换为严格的
  ProjectDocument v6 / SurfaceGraph v1 合同，加入 Dataset/Resource 基础引用、
  Project/Surface transfer、Surface-aware Vue backend，并发布共享 Prototype Runtime
  的无 DOM session 与 Vue overlay host。旧 Page-only、事件编排、事件转发和 Flow 合同
  不提供兼容读取器。

### Patch Changes

- 6d49398: 将 ConfigForm 定型为 Runtime-first 表单方案，完整删除事件编辑、事件转发与 Flow 编排合同，Designer 收敛为 properties 与 validation 两个默认区域。复杂组件事件由宿主在运行时 config 的 `props.onX` 中直接维护；持久化、编译、Preview 与 Source 合同同步硬切到无事件编排的当前版本。
- Updated dependencies [9d21019]
- Updated dependencies [6d49398]
- Updated dependencies [9772a58]
  - @moluoxixi/config-form@0.3.0
  - @moluoxixi/config-form-headless@0.3.0

## 0.2.6

### Patch Changes

- Automatically release packages changed in 8a0a9f830270.
- Updated dependencies
  - @moluoxixi/config-form@0.2.5
  - @moluoxixi/config-form-headless@0.2.6

## 0.2.5

### Patch Changes

- Automatically release packages changed in b0d4a5d86281.
- Updated dependencies
  - @moluoxixi/config-form@0.2.4
  - @moluoxixi/config-form-headless@0.2.5

## 0.2.4

### Patch Changes

- Automatically release packages changed in a5b09dcff5c6.
- Updated dependencies [e317c5c]
  - @moluoxixi/config-form-headless@0.2.4
  - @moluoxixi/config-form@0.2.3

## 0.2.3

### Patch Changes

- Automatically release packages changed in 673d9e24983b.
- Updated dependencies
  - @moluoxixi/config-form@0.2.3
  - @moluoxixi/config-form-headless@0.2.3

## 0.2.2

### Patch Changes

- Automatically release packages changed in 2c31e9a8f75f.
- Updated dependencies
  - @moluoxixi/config-form@0.2.2
  - @moluoxixi/config-form-headless@0.2.2

## 0.2.1

### Patch Changes

- Automatically release packages changed in 018d8653e054.
- Updated dependencies
  - @moluoxixi/config-form@0.2.1
  - @moluoxixi/config-form-headless@0.2.1

## 0.2.0

### Minor Changes

- e11fc22: Expand `@moluoxixi/config-form-headless` into the shared Vue headless light-form kernel with required/Zod/custom validation, normalized errors, stale-safe async validation and submit snapshots, dynamic reset defaults, readonly, and readonlyRender. Add a shared Vue DOM renderer at `@moluoxixi/config-form/renderer` for native form, Grid/Flex, recursive nodes, field shells, ARIA, binding presets, and controlled expose APIs while retaining the root Runtime/Plugin route for schema and UI plugins. Move the standalone Element Plus, Ant Design Vue, and `@moluoxixi/components` ConfigForm implementations to thin adapters over that renderer, without UI-library Form/FormItem/Row/Col components. Add `@moluoxixi/config-form-designer-antd-vue` as an independent visual-designer adapter with real Ant Design Vue materials, option resolution, default-value controls, readonly rendering, responsive layouts, localized setters, and password/search/autocomplete/slider/rate fields. Make designer selection outlines track the actual rendered component with a 5px measured expansion instead of the full grid cell. Rename DOM passthrough APIs to `formAttrs`, `layoutAttrs`, `cellAttrs`, and `fieldAttrs`, including their public adapter type aliases, and deprecate the generic `withInstall` export from headless. Track reset-baseline dirty/touched metadata independently from `validateOn`, expose it through `metaChange`, slot `meta`, `getMeta`, `getFieldMeta`, and `setTouched`, and add `data-dirty` / `data-touched` hooks to renderer form and field DOM. Breaking: remove the unsupported `@moluoxixi/config-form-shadcn-vue` and `@moluoxixi/config-form-plugin-shadcn-vue` packages in favor of adapters backed by stable upstream Vue component contracts.

### Patch Changes

- Updated dependencies [e11fc22]
  - @moluoxixi/config-form@0.2.0
  - @moluoxixi/config-form-headless@0.2.0
