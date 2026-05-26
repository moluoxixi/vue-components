# ConfigForm Controlled Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in controlled `modelValue` mode to `ConfigForm` so the form can infer and synchronize its typed model from a parent-owned value while keeping the current uncontrolled `defaultValues` path.

**Architecture:** Keep the internal reactive `values` store as the runtime source inside `useForm`, but let it mirror either `defaultValues` (uncontrolled) or `modelValue` (controlled). Controlled mode must emit `update:modelValue` after local writes and resync from external prop changes without feedback loops. `defaultValues` stays the initialization snapshot only; it should not compete with `modelValue` as the source of truth.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vue Test Utils, Vite playgrounds.

---

## Task 1: Define the controlled public contract

**Files:**
- Modify: `packages/ConfigForm/src/types/index.ts`
- Modify: `packages/ConfigForm/src/index.vue`
- Modify: `packages/ConfigForm/__tests__/publicApi.test.ts`

- [ ] **Step 1: Add failing public API assertions**

```ts
type HasModelValue = 'modelValue' extends keyof PublicApi.ConfigFormProps ? true : false
type HasUpdateModelValue = PublicApi.ConfigFormEmits extends {
  (e: 'update:modelValue', values: Record<string, unknown>): void
} ? true : false
```

- [ ] **Step 2: Extend the component contract**
  - Add `modelValue?: T` to `ConfigFormProps<T>`.
  - Add `(e: 'update:modelValue', values: T): void` to `ConfigFormEmits<T>`.
  - Pass `props.modelValue` and `update:modelValue` through `src/index.vue` into the form controller.

- [ ] **Step 3: Run the public API test**

Run: `pnpm -C packages/ConfigForm test`
Expected: PASS

## Task 2: Make `useForm` support controlled state

**Files:**
- Modify: `packages/ConfigForm/src/composables/useForm.ts`
- Modify: `packages/ConfigForm/__tests__/useForm.test.ts`

- [ ] **Step 1: Add failing sync tests**
  - Controlled prop changes must update the local `values` store.
  - `setValue`, `setValues`, and `reset` must emit `update:modelValue` in controlled mode.
  - Uncontrolled mode must keep the current `defaultValues` behavior and emit nothing.

```ts
interface LoginFormValues {
  username?: string
}

const external = ref<LoginFormValues>({ username: 'Ada' })
const updates: LoginFormValues[] = []
const form = useForm({
  fields,
  modelValue: external,
  onUpdateModelValue: next => updates.push(next),
})

form.setValue('username', 'Grace')
expect(updates.at(-1)?.username).toBe('Grace')
```

- [ ] **Step 2: Add controlled-mode plumbing**
  - Add controlled inputs to `UseFormOptions<T>`.
  - Mirror external `modelValue` into the internal store with a guarded `watch`.
  - Emit the latest full model after local writes, but only in controlled mode.
  - Keep validation, submit, and reset logic unchanged for uncontrolled usage.

- [ ] **Step 3: Run the composable tests**

Run: `pnpm -C packages/ConfigForm test`
Expected: PASS

## Task 3: Update docs and visible examples

**Files:**
- Modify: `packages/ConfigForm/README.md`
- Modify: `packages/ConfigForm/src/README.md`
- Modify: `playgrounds/element-plus-playground/src/demos/GridForm.vue`
- Modify: `playgrounds/antd-vue-playground/src/demos/GridForm.vue`

- [ ] **Step 1: Document controlled vs uncontrolled behavior**
  - Explain that `defaultValues` is the uncontrolled initialization snapshot.
  - Explain that `modelValue` is the controlled source of truth.
  - Show one minimal controlled example in the README.

- [ ] **Step 2: Exercise the new path in both playgrounds**
  - Bind each Grid demo to a local `modelValue` ref.
  - Keep the existing validation and submit interactions intact.
  - Make the visible snapshot reflect the controlled state so the demo proves the update loop.

- [ ] **Step 3: Run the playground typechecks**

Run: `pnpm -C playgrounds/element-plus-playground typecheck`
Expected: PASS

Run: `pnpm -C playgrounds/antd-vue-playground typecheck`
Expected: PASS

## Task 4: Verify the full workspace

**Files:**
- None

- [ ] **Step 1: Run workspace lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 2: Run workspace typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Run workspace build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 4: Start one playground and verify it in the browser**

Run: `pnpm -C playgrounds/element-plus-playground dev`
Expected: local Vite server starts cleanly and the Grid demo renders with the controlled snapshot updating on input.
