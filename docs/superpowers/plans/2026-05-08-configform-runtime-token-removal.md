# ConfigForm Runtime Token Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild ConfigForm so the root component recursively processes every field config, removes snap/token APIs, and lets render components consume only processed fields.

**Architecture:** `ConfigForm` owns the field processing pipeline: raw `fields` -> `runtime.transformField(...)` recursively -> processed nodes -> `useForm` and render components. Runtime has two explicit operations, `resolveField(field)` for built-in defaults and `transformField(field)` for plugin conversion with priority `user > plugin > built-in`; render components no longer call runtime or receive snap data.

**Tech Stack:** Vue 3 SFC with `<script setup lang="ts">`, TypeScript, Vite, Vitest, Vue Test Utils, pnpm workspace.

---

## Task 1: Lock The New Public Runtime Contract

**Files:**
- Modify: `packages/ConfigForm/tests/pluginApi.test.ts`
- Modify: `packages/ConfigForm/tests/publicApi.test.ts`
- Modify: `packages/ConfigForm/tests/defineField.test.ts`
- Modify: `packages/ConfigForm/tests/runtime.test.ts`

- [ ] **Step 1: Write failing type and runtime tests**

Tests must assert that `createRuntimeToken`, `isRuntimeToken`, `RuntimeToken`, `FormRuntimeResolveSnap`, `createResolveSnap`, `transformNode`, `resolveNode`, `resolveSlot`, `resolveVisible`, and `resolveDisabled` are no longer exported. Tests must assert `resolveField` and `transformField` exist.

- [ ] **Step 2: Run targeted tests and confirm RED**

Run: `pnpm -C packages/ConfigForm test -- tests/pluginApi.test.ts tests/publicApi.test.ts tests/defineField.test.ts tests/runtime.test.ts`

Expected: failures from removed target API not yet implemented.

- [ ] **Step 3: Implement the contract**

Update runtime/types/exports so plugin API only exposes component registration, field transforms, `resolveField`, and `transformField`.

- [ ] **Step 4: Run targeted tests and confirm GREEN**

Run: `pnpm -C packages/ConfigForm test -- tests/pluginApi.test.ts tests/publicApi.test.ts tests/defineField.test.ts tests/runtime.test.ts`

Expected: all targeted tests pass.

## Task 2: Move Recursive Field Processing To ConfigForm

**Files:**
- Modify: `packages/ConfigForm/src/index.vue`
- Modify: `packages/ConfigForm/src/composables/useForm.ts`
- Modify: `packages/ConfigForm/src/components/RecursiveField/src/index.vue`
- Modify: `packages/ConfigForm/src/components/FormNode/src/index.vue`
- Modify: `packages/ConfigForm/src/components/FormField/src/index.vue`
- Modify: `packages/ConfigForm/src/components/FormComponent/src/index.vue`
- Modify: `packages/ConfigForm/tests/components.test.ts`
- Modify: `packages/ConfigForm/tests/useForm.test.ts`
- Modify: `packages/ConfigForm/tests/slotDefineField.test.ts`

- [ ] **Step 1: Write failing component tests**

Tests must cover raw config nodes in slots, scoped slot functions returning configs, root-level recursive processing, `provide` context values/actions, and absence of `resolveSnap` props.

- [ ] **Step 2: Run targeted tests and confirm RED**

Run: `pnpm -C packages/ConfigForm test -- tests/components.test.ts tests/useForm.test.ts tests/slotDefineField.test.ts`

Expected: failures because components still process slots through runtime/snap.

- [ ] **Step 3: Implement root-owned recursion**

`ConfigForm` computes processed nodes, passes processed nodes to `useForm`, provides context, and renders `RecursiveField` without runtime/snap. Components render processed fields and only use injected context for values, errors, visibility, disabled, and actions.

- [ ] **Step 4: Run targeted tests and confirm GREEN**

Run: `pnpm -C packages/ConfigForm test -- tests/components.test.ts tests/useForm.test.ts tests/slotDefineField.test.ts`

Expected: all targeted tests pass.

## Task 3: Update Official Plugins For The New Field Transform API

**Files:**
- Modify: `packages/ConfigFormPluginAntdVue/src/index.ts`
- Modify: `packages/ConfigFormPluginAntdVue/tests/antdVuePlugin.test.ts`
- Modify: `packages/ConfigFormPluginI18n/src/index.ts`
- Modify: `packages/ConfigFormPluginI18n/tests/i18nPlugin.test.ts`

- [ ] **Step 1: Write failing plugin tests**

AntD tests must use `runtime.transformField(...)` and prove explicit user bindings beat plugin bindings. I18n tests must no longer import or create runtime tokens.

- [ ] **Step 2: Run targeted tests and confirm RED**

Run: `pnpm -C packages/ConfigFormPluginAntdVue test && pnpm -C packages/ConfigFormPluginI18n test`

Expected: failures from legacy `resolveField(..., snap)` and token API usage.

- [ ] **Step 3: Implement plugin updates**

AntD plugin switches to `transformField`. I18n plugin becomes an explicit field transform plugin using configured field mappings and no token objects.

- [ ] **Step 4: Run targeted tests and confirm GREEN**

Run: `pnpm -C packages/ConfigFormPluginAntdVue test && pnpm -C packages/ConfigFormPluginI18n test`

Expected: both plugin packages pass.

## Task 4: Sync Playgrounds And Documentation

**Files:**
- Modify: `README.md`
- Modify: `packages/ConfigForm/README.md`
- Modify: `packages/ConfigForm/src/README.md`
- Modify: `packages/ConfigFormPluginI18n/README.md`
- Modify: `playgrounds/element-plus-playground/src/demos/I18nPluginForm.vue`
- Modify: `playgrounds/antd-vue-playground/src/demos/I18nPluginForm.vue`

- [ ] **Step 1: Update examples away from token APIs**

Docs and demos must describe `resolveField`/`transformField`, root-owned recursion, and the i18n mapping plugin shape.

- [ ] **Step 2: Run docs/playground build checks**

Run: `pnpm build`

Expected: workspace build succeeds after source changes.

## Task 5: Full Verification

**Files:**
- Modify: `.agent/_workflow_state.json`

- [ ] **Step 1: Run required quality gates**

Run: `pnpm lint`

Run: `pnpm typecheck`

Run: `pnpm test`

Run: `pnpm test:coverage`

Run: `pnpm build`

- [ ] **Step 2: Record results**

Update `.agent/_workflow_state.json` with command names, exit status, and any failed or missing checks. Do not mark unconditional completion if any command fails or coverage is below threshold.
