# Component Guidelines

> How components are built in this project.

---

## Overview

Public Vue components keep rendering contracts, state ownership, and consumer responsibilities explicit. Additive props, slots, events, and exposed APIs must preserve the rendering path used by consumers that do not opt into the new behavior.

---

## Component Structure

- Put shared state machines and resolution rules in typed composables.
- Keep framework adapters thin when multiple components expose the same behavior.
- Export public props, emits, slots, exposes, and related payload types through the component's public type barrel.
- Use stable domain identity for state that survives sorting, filtering, pagination, or replacement of array instances.

---

## Props Conventions

- Props provide declarative base state. Imperative exposed APIs may add ephemeral overrides, but must not silently convert a prop into a v-model contract.
- Define defaults with `withDefaults` when an omitted prop has a stable behavioral meaning.
- An event named `update:<prop>` is reserved for an actual controlled/v-model contract. Observational changes use a domain event with a typed payload.

---

## Styling Patterns

- Publish package-level CSS through explicit export-map entries.
- Keep component class names package-prefixed, such as `.mx-*`, so packed consumer tests can verify stylesheet availability without relying on source paths.
- Declare CSS and preprocessor sources in package `sideEffects` when consumers must retain them during bundling.

---

## Accessibility

- Synchronize browser tests with observable component state such as ARIA attributes instead of animation or overlay timing.
- Consumer-provided edit controls own their labels, focus behavior, keyboard interaction, validation, and error announcements.

---

## Scenario: Editable Table Rendering Modes

### 1. Scope / Trigger

Apply this contract when a table supports display/edit rendering at table, row, or cell scope. Mode controls rendering intent only; consumers own triggers, form controls, save/cancel, validation, persistence, and row-data mutation.

### 2. Signatures

```ts
type HeadlessTableMode = 'default' | 'edit'
type HeadlessTableRowKey = string | number

interface HeadlessTableModeApi {
  readonly mode: Readonly<Ref<HeadlessTableMode>>
  setMode(mode: HeadlessTableMode): void
  clearMode(): void
  setRowMode(rowId: HeadlessTableRowKey, mode: HeadlessTableMode): void
  clearRowMode(rowId: HeadlessTableRowKey): void
  clearAllRowModes(): void
  setCellMode(rowId: HeadlessTableRowKey, columnId: string, mode: HeadlessTableMode): void
  clearCellMode(rowId: HeadlessTableRowKey, columnId: string): void
  clearAllCellModes(): void
  clearAllModes(): void
  getRowMode(rowId: HeadlessTableRowKey): HeadlessTableMode
  getCellMode(rowId: HeadlessTableRowKey, columnId: string): HeadlessTableMode
}
```

### 3. Contracts

- Effective mode resolution is `cell override -> row override -> global API override -> mode prop -> default`.
- Only the prop controls the table-wide base declaratively. All three scopes are mutable through the exposed API.
- Row and cell overrides use stable row ids and stable column ids, never visible array indexes.
- Edit renderer selection is `inline edit slot -> named edit slot -> unchanged default renderer chain`.
- The default renderer chain stays `inline default slot -> named default slot -> renderer registry -> formatter -> raw value`.
- Slot scopes expose effective `mode`, stable `rowId`, row/column context, and scoped mode actions.
- `clearAllRowModes()` clears row overrides only; `clearAllCellModes()` clears cell overrides only; `clearAllModes()` clears global, row, and cell API overrides.
- Every effective API mutation emits one typed `modeChange`; no-op mutations emit nothing. Bulk changes emit once with the number of overrides cleared.
- `modeChange` is observational. Do not emit `update:mode` for ephemeral API overrides.

### 4. Validation & Error Matrix

| Input or state | Required behavior |
| --- | --- |
| Omitted `mode` | Resolve to `default` |
| `mode="edit"` | Render every cell through edit selection unless a narrower API override wins |
| Missing edit slot | Fall through to the unchanged default renderer chain |
| Row/cell action without stable row identity | Fail with a clear diagnostic; never key by row index |
| Setting an override to its current value | Keep state unchanged and emit no event |
| Clearing an absent override | Keep state unchanged and emit no event |
| Clearing an override above an edit prop | Reveal the prop's `edit` value, not `default` |

### 5. Good/Base/Bad Cases

- Good: a cell override remains attached to the same row after sorting because the key comes from `getRowId` or a configured stable `rowKey`.
- Base: a consumer that provides no mode prop, edit slot, or mode API call renders exactly through the pre-existing default chain.
- Bad: storing overrides by row index, mutating row data when mode changes, or building save/validation behavior into the headless table.

### 6. Tests Required

- Assert the full precedence matrix and each clear path.
- Assert global prop and API interaction, including clearing an API override back to the prop.
- Assert row reorder/filter/pagination retains override identity.
- Assert inline edit, named edit, and missing-edit fallback rendering.
- Assert single and bulk event payloads, no-op silence, and one event per bulk action.
- Assert public type barrels, bilingual API docs, and exposed component methods stay aligned.

### 7. Wrong vs Correct

#### Wrong

```ts
const rowModes = new Map<number, HeadlessTableMode>()
rowModes.set(rowIndex, 'edit')
emit('update:mode', 'edit')
```

#### Correct

```ts
const rowId = getRowId(row)
modeApi.setRowMode(rowId, 'edit')
// The component emits typed modeChange; the mode prop remains the base value.
```

---

## Common Mistakes

- Treating an edit mode as a form engine instead of a renderer-selection contract.
- Replacing the default renderer path when an optional edit slot is absent.
- Emitting multiple notifications while executing one bulk cleanup API call.
- Duplicating the same mode-resolution logic in each table adapter instead of reusing the shared composable.
