# ConfigForm Readonly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add field-level readonly rendering to ConfigForm, with generic core support and component-specific adapters supplied by Element Plus and Ant Design Vue plugins.

**Architecture:** The core package owns only the readonly state, runtime adapter registry, raw value fallback, and readonly render branch. UI libraries own component-specific display mapping through `readonlyAdapters`. Element Plus gets a new plugin package; Ant Design Vue extends the existing plugin.

**Tech Stack:** Vue 3 SFC, TypeScript, Vite library builds, Vitest, Vue Test Utils, pnpm workspace.

---

## File Structure

Core package:

- Modify: `packages/ConfigForm/src/types/index.ts`
  - Add `readonly?: FieldCondition<FormValues>` to bound field config.
- Modify: `packages/ConfigForm/src/runtime/types.ts`
  - Add `ReadonlyAdapter`, `ReadonlyRenderContext`, `readonlyAdapters` options, and `FormRuntime.readonlyAdapters`.
- Modify: `packages/ConfigForm/src/runtime/createFormRuntime.ts`
  - Merge user and plugin readonly adapters using the same conflict rules as component registration.
- Create: `packages/ConfigForm/src/runtime/readonly.ts`
  - Resolve component keys and default raw value rendering.
- Modify: `packages/ConfigForm/src/runtime/index.ts`
  - Export readonly types and helper where needed by plugin authors.
- Modify: `packages/ConfigForm/src/plugins/index.ts`
  - Re-export readonly plugin API types.
- Modify: `packages/ConfigForm/src/composables/useFormContext.ts`
  - Add `isReadonly`.
- Modify: `packages/ConfigForm/src/composables/useForm.ts`
  - Resolve readonly state, skip validation for readonly fields, and keep readonly values in submit output.
- Modify: `packages/ConfigForm/src/index.vue`
  - Provide `isReadonly` through form context.
- Modify: `packages/ConfigForm/src/components/FormItem/src/index.vue`
  - Add a `showError` prop so readonly display can reuse layout without showing stale errors.
- Create: `packages/ConfigForm/src/components/ReadonlyField/index.ts`
- Create: `packages/ConfigForm/src/components/ReadonlyField/src/index.vue`
- Create: `packages/ConfigForm/src/components/ReadonlyField/src/composables/useReadonlyField.ts`
- Create: `packages/ConfigForm/src/components/ReadonlyField/src/types/props.ts`
  - Render FormItem + readonly value from the resolved adapter.
- Modify: `packages/ConfigForm/src/components/RecursiveField/src/composables/useRecursiveField.ts`
  - Route readonly bound nodes to `ReadonlyField`.
- Test: `packages/ConfigForm/__tests__/runtime.test.ts`
- Test: `packages/ConfigForm/__tests__/useForm.test.ts`
- Test: `packages/ConfigForm/__tests__/components.test.ts`
- Test: `packages/ConfigForm/__tests__/pluginApi.test.ts`

Element Plus plugin package:

- Create: `packages/ConfigFormPluginElementPlus/package.json`
- Create: `packages/ConfigFormPluginElementPlus/index.ts`
- Create: `packages/ConfigFormPluginElementPlus/src/index.ts`
- Create: `packages/ConfigFormPluginElementPlus/src/readonly.ts`
- Create: `packages/ConfigFormPluginElementPlus/__tests__/elementPlusPlugin.test.ts`
- Create: `packages/ConfigFormPluginElementPlus/vite.config.ts`
- Create: `packages/ConfigFormPluginElementPlus/tsconfig.json`
- Create: `packages/ConfigFormPluginElementPlus/tsconfig.base.json`
- Create: `packages/ConfigFormPluginElementPlus/tsconfig.app.json`
- Create: `packages/ConfigFormPluginElementPlus/tsconfig.test.json`
- Create: `packages/ConfigFormPluginElementPlus/README.md`

Ant Design Vue plugin:

- Modify: `packages/ConfigFormPluginAntdVue/src/index.ts`
- Modify: `packages/ConfigFormPluginAntdVue/__tests__/antdVuePlugin.test.ts`
- Modify: `packages/ConfigFormPluginAntdVue/README.md`

Playgrounds and docs:

- Create: `playgrounds/element-plus-playground/src/demos/ReadonlyForm.vue`
- Modify: `playgrounds/element-plus-playground/src/App.vue`
- Modify: `playgrounds/element-plus-playground/package.json`
- Create: `playgrounds/antd-vue-playground/src/demos/ReadonlyForm.vue`
- Modify: `playgrounds/antd-vue-playground/src/App.vue`
- Modify: `README.md`
- Modify: `packages/ConfigForm/README.md`

## Task 1: Core Readonly Contract And Render Branch

**Files:**
- Modify: `packages/ConfigForm/src/types/index.ts`
- Modify: `packages/ConfigForm/src/runtime/types.ts`
- Modify: `packages/ConfigForm/src/runtime/createFormRuntime.ts`
- Create: `packages/ConfigForm/src/runtime/readonly.ts`
- Modify: `packages/ConfigForm/src/runtime/index.ts`
- Modify: `packages/ConfigForm/src/plugins/index.ts`
- Modify: `packages/ConfigForm/src/composables/useFormContext.ts`
- Modify: `packages/ConfigForm/src/composables/useForm.ts`
- Modify: `packages/ConfigForm/src/index.vue`
- Modify: `packages/ConfigForm/src/components/FormItem/src/index.vue`
- Create: `packages/ConfigForm/src/components/ReadonlyField/index.ts`
- Create: `packages/ConfigForm/src/components/ReadonlyField/src/index.vue`
- Create: `packages/ConfigForm/src/components/ReadonlyField/src/composables/useReadonlyField.ts`
- Create: `packages/ConfigForm/src/components/ReadonlyField/src/types/props.ts`
- Modify: `packages/ConfigForm/src/components/RecursiveField/src/composables/useRecursiveField.ts`
- Test: `packages/ConfigForm/__tests__/runtime.test.ts`
- Test: `packages/ConfigForm/__tests__/useForm.test.ts`
- Test: `packages/ConfigForm/__tests__/components.test.ts`
- Test: `packages/ConfigForm/__tests__/pluginApi.test.ts`

- [ ] **Step 1: Add failing runtime and public API tests**

Add assertions that `createFormRuntime` exposes `readonlyAdapters`, rejects plugin adapter key conflicts, and plugin API exports `ReadonlyAdapter` / `ReadonlyRenderContext`.

```ts
const readonlyAdapter: ReadonlyAdapter = ({ value }) => value
const runtime = createFormRuntime({
  readonlyAdapters: { MyInput: readonlyAdapter },
})

expect(runtime.readonlyAdapters.MyInput).toBe(readonlyAdapter)
```

- [ ] **Step 2: Add failing form behavior tests**

Add tests that:

- readonly fields render raw text instead of the editable component.
- readonly fields skip validation and clear their own error.
- readonly fields still submit values.
- readonly wins over disabled when both evaluate to true.

```ts
const fields = [
  defineField({
    field: 'name',
    label: '姓名',
    component: TextInput,
    defaultValue: 'Alice',
    readonly: true,
    disabled: true,
    validator: () => 'should not run',
  }),
]
```

- [ ] **Step 3: Run targeted core tests and confirm RED**

Run:

```bash
pnpm -C packages/ConfigForm test -- __tests__/runtime.test.ts __tests__/useForm.test.ts __tests__/components.test.ts __tests__/pluginApi.test.ts
```

Expected: FAIL because readonly types, runtime registry, and render branch do not exist yet.

- [ ] **Step 4: Implement core readonly types and runtime registry**

Add:

```ts
export type ReadonlyAdapter = (ctx: ReadonlyRenderContext) => VNodeChild

export interface ReadonlyRenderContext {
  values: FormValues
  value: unknown
  field: string
  node: ResolvedBoundNode
}
```

Add `readonlyAdapters?: Record<string, ReadonlyAdapter>` to `FormRuntimeOptions` and `FormRuntimePlugin`, and `readonlyAdapters: Record<string, ReadonlyAdapter>` to `FormRuntime`.

- [ ] **Step 5: Implement readonly state in useForm**

Add `isReadonly(field)` beside `isDisabled(field)`. Validation must clear and skip readonly fields. Submit must include readonly fields before checking disabled skip rules.

```ts
if (resolveValue(field.readonly, valuesSnapshot, false)) {
  clearFieldError(fieldName)
  return true
}
```

- [ ] **Step 6: Implement ReadonlyField rendering**

Create `ReadonlyField` that reuses `FormItem`, passes `showError={false}`, resolves the adapter from runtime, and falls back to raw value text.

- [ ] **Step 7: Route readonly fields from RecursiveField**

When a node is a bound field and `ctx.isReadonly(field)` is true, render `ReadonlyField`. Containers are never treated as readonly.

- [ ] **Step 8: Run targeted core tests and confirm GREEN**

Run:

```bash
pnpm -C packages/ConfigForm test -- __tests__/runtime.test.ts __tests__/useForm.test.ts __tests__/components.test.ts __tests__/pluginApi.test.ts
```

Expected: PASS.

## Task 2: Element Plus Readonly Plugin

**Files:**
- Create: `packages/ConfigFormPluginElementPlus/package.json`
- Create: `packages/ConfigFormPluginElementPlus/index.ts`
- Create: `packages/ConfigFormPluginElementPlus/src/index.ts`
- Create: `packages/ConfigFormPluginElementPlus/src/readonly.ts`
- Create: `packages/ConfigFormPluginElementPlus/__tests__/elementPlusPlugin.test.ts`
- Create: `packages/ConfigFormPluginElementPlus/vite.config.ts`
- Create: `packages/ConfigFormPluginElementPlus/tsconfig.json`
- Create: `packages/ConfigFormPluginElementPlus/tsconfig.base.json`
- Create: `packages/ConfigFormPluginElementPlus/tsconfig.app.json`
- Create: `packages/ConfigFormPluginElementPlus/tsconfig.test.json`
- Create: `packages/ConfigFormPluginElementPlus/README.md`

- [ ] **Step 1: Add failing plugin tests**

Tests must cover:

- `createElementPlusPlugin()` returns a `FormRuntimePlugin`.
- It exposes `readonlyAdapters`.
- `ElColorPicker` renders a swatch and value.
- `ElCheckboxGroup` and `ElRadioGroup` resolve labels from options or slot-like option props.
- User adapter overrides plugin adapter.

- [ ] **Step 2: Run Element Plus plugin test and confirm RED**

Run:

```bash
pnpm -C packages/ConfigFormPluginElementPlus test
```

Expected: FAIL because the package does not exist yet.

- [ ] **Step 3: Scaffold plugin package from Antd package conventions**

Use the Antd package structure and scripts. The package name must be:

```json
{
  "name": "@moluoxixi/config-form-plugin-element-plus"
}
```

Peer dependencies must include `@moluoxixi/config-form` and `element-plus`.

- [ ] **Step 4: Implement Element Plus readonly adapters**

Add `ELEMENT_PLUS_READONLY_ADAPTERS` and `createElementPlusPlugin({ name, readonlyAdapters })`.

Supported keys:

- `ElInput`
- `ElInputNumber`
- `ElSelectV2`
- `ElAutocomplete`
- `ElTreeSelect`
- `ElCascader`
- `ElRadio`
- `ElRadioGroup`
- `ElCheckbox`
- `ElCheckboxGroup`
- `ElSwitch`
- `ElRate`
- `ElDatePicker`
- `ElTimePicker`
- `ElTimeSelect`
- `ElColorPicker`

- [ ] **Step 5: Run Element Plus plugin tests and confirm GREEN**

Run:

```bash
pnpm -C packages/ConfigFormPluginElementPlus test
```

Expected: PASS.

## Task 3: Ant Design Vue Readonly Adapters

**Files:**
- Modify: `packages/ConfigFormPluginAntdVue/src/index.ts`
- Modify: `packages/ConfigFormPluginAntdVue/__tests__/antdVuePlugin.test.ts`
- Modify: `packages/ConfigFormPluginAntdVue/README.md`

- [ ] **Step 1: Add failing Antd plugin tests**

Tests must cover:

- plugin exposes `readonlyAdapters`.
- `ASelect` maps values to labels from `props.options`.
- `ACheckboxGroup` maps selected values to labels.
- `ARadioGroup` maps current value to label.
- `ASwitch` uses declared checked / unchecked labels when available.
- user adapters override built-in plugin adapters.

- [ ] **Step 2: Run Antd plugin tests and confirm RED**

Run:

```bash
pnpm -C packages/ConfigFormPluginAntdVue test
```

Expected: FAIL because readonly adapters are not implemented.

- [ ] **Step 3: Implement Antd readonly adapters**

Extend `createAntdVuePlugin` with `readonlyAdapters?: Record<string, ReadonlyAdapter>`, merge user adapters after defaults, and include them on the returned plugin.

- [ ] **Step 4: Run Antd plugin tests and confirm GREEN**

Run:

```bash
pnpm -C packages/ConfigFormPluginAntdVue test
```

Expected: PASS.

## Task 4: Playgrounds And Documentation

**Files:**
- Create: `playgrounds/element-plus-playground/src/demos/ReadonlyForm.vue`
- Modify: `playgrounds/element-plus-playground/src/App.vue`
- Modify: `playgrounds/element-plus-playground/package.json`
- Create: `playgrounds/antd-vue-playground/src/demos/ReadonlyForm.vue`
- Modify: `playgrounds/antd-vue-playground/src/App.vue`
- Modify: `README.md`
- Modify: `packages/ConfigForm/README.md`
- Modify: `packages/ConfigFormPluginAntdVue/README.md`
- Create: `packages/ConfigFormPluginElementPlus/README.md`

- [ ] **Step 1: Add Element Plus readonly demo**

The demo must show readonly text, select label mapping, checkbox group labels, radio label, switch label, and color swatch.

- [ ] **Step 2: Add Antd readonly demo**

The demo must show readonly text, select label mapping, checkbox group labels, radio label, and switch label. Do not add an Antd color example because the current local Ant Design Vue dependency does not expose a color picker component.

- [ ] **Step 3: Update docs**

Document:

- `readonly?: FieldCondition<FormValues>`
- `readonlyAdapters?: Record<string, ReadonlyAdapter>`
- core raw fallback
- Element Plus plugin usage
- Antd plugin usage

- [ ] **Step 4: Run playground typecheck and build checks**

Run:

```bash
pnpm -C playgrounds/element-plus-playground typecheck
pnpm -C playgrounds/antd-vue-playground typecheck
pnpm -C playgrounds/element-plus-playground build
pnpm -C playgrounds/antd-vue-playground build
```

Expected: PASS.

## Task 5: Full Verification

**Files:**
- No source edits unless checks expose real failures.

- [ ] **Step 1: Run workspace quality gates**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: PASS.

- [ ] **Step 2: Run coverage if targeted checks are healthy**

Run:

```bash
pnpm test:coverage
```

Expected: PASS or report the exact package and threshold failure.

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intended source, docs, tests, lockfile, and package files changed.
