# Component Guidelines

> How components are built in this project.

---

## Overview

ConfigForm designer property panels use the same renderer contract as runtime forms. The designer core owns field projection and document/history commands; adapter packages inject framework-native ordinary controls. Core designer code must remain independent of Element Plus and Ant Design Vue.

## Component Structure

`DesignerPropertySetterDefinition` is projected into one `ConfigFormRenderer` field list by `DesignerPropertyForm`.

```text
setter definition -> ConfigFormRenderer field -> fieldChange/blur -> commit -> updateNodePath/updateForm -> history
```

Simple controls use `DesignerPropertyControlRegistry`; structured and custom controls use `DesignerSetter` as a ConfigForm custom field. A custom setter component follows `modelValue` / `update:modelValue` and is adapted to the property form's `commit` event.

## Props Conventions

The registry contract is framework-neutral:

```ts
interface DesignerPropertyControlDefinition {
  component: Component
  valueProp?: string
  trigger?: string
  blurTrigger?: string
  getValueFromEvent?: (event: unknown, ...args: unknown[]) => unknown
  props?: Record<string, unknown>
}
```

Adapters register native bindings (`update:modelValue` for Element Plus text inputs, `value`/`update:value` for Ant Design Vue text inputs, `change` for numeric/boolean/segmented controls). Property writes must continue through `updateNodePath` / `updateForm`; direct document mutation is forbidden.

Text and textarea fields keep the ConfigForm draft while editing and commit once on blur. When no simple control is registered, the `DesignerSetter` fallback emits its blur `commit` through `ConfigFormRenderer`; the handler must not discard that event.

## Styling Patterns

Simple property fields use a stable left label track and flexible control track. Custom fields own their internal composition and remain full width. Adapter controls keep their native visual and value contracts; the core adds only designer field classes and accessibility metadata.

## Accessibility

Every injected property control receives the setter label as `aria-label`; inherited values use `aria-description` and `data-inherited-label`. Native adapter roles and keyboard behavior must remain intact. Blur and keyboard submission behavior is covered at the designer level, not only by adapter metadata tests.

## Contracts

### 1. Scope / Trigger

- Trigger: adding or changing a ConfigForm designer property setter, adapter property-control registry, or custom setter component.

### 2. Signatures

- `DesignerPropertyForm` emits `commit(value, setter)`.
- `DesignerPropertyPanel` maps the commit to `updateNodePath(path, value)` or `updateForm(patch)`.
- `ConfigFormRenderer` receives a stable field key and binding (`valueProp`, `trigger`, optional `blurTrigger`).

### 3. Contracts

- Simple setter input events update only the renderer's internal draft for text/textarea.
- Text/textarea blur emits at most one semantic commit when the normalized value changed.
- Custom setter updates use `modelValue` / `update:modelValue`, then one `commit` event.
- All commits are normalized before reducer/history handling; `undefined` deletes an optional path.
- Adapter packages export their property-control map and preserve native component dependencies as external imports.

### 4. Validation & Error Matrix

| Condition | Expected behavior |
| --- | --- |
| Registered text control receives input | Update draft; do not update document/history |
| Registered text control loses focus with changed value | Emit one commit and one history entry |
| Same text loses focus again | No additional commit/history |
| No registered text control | Fallback custom setter blur commit reaches document/history |
| Number is empty | Normalize to `undefined` |
| Number is non-finite | Ignore the event |
| Number is outside min/max | Clamp before commit |
| Custom component has no update event | Keep document unchanged; expose component contract error in integration tests |

### 5. Good/Base/Bad Cases

- Good: adapter registry supplies a native component and binding; custom setters remain renderer fields; history sees one normalized command.
- Base: no adapter registry is supplied; `DesignerSetter` fallback still renders and persists text on blur.
- Bad: filtering every text `fieldChange` unconditionally, which drops fallback blur commits and silently loses edits.

### 6. Tests Required

- Core unit: simple and custom fields are both children of one `ConfigFormRenderer`; fallback text blur persists.
- Designer integration: input does not emit `update:document` before blur; changed blur emits once; undo/redo restores both states.
- Adapter E2E: Element Plus and Ant Design Vue assert native property controls, left labels, text blur, custom setter, and narrow layout.
- Package boundary: adapter export verification includes the property-control map and type-checks a consumer import.

### 7. Wrong vs Correct

#### Wrong

```ts
if (setter.control === 'text')
  return // drops both draft events and fallback blur commits
```

#### Correct

```ts
if ((setter.control === 'text' || setter.control === 'textarea') && controlFor(entry))
  return // ignore only registered-control draft events
```

## Common Mistakes

- Importing Element Plus or Ant Design Vue directly from `packages/ConfigForm/designer`.
- Testing only registry metadata instead of mounting the real adapter control through ConfigFormRenderer.
- Adding a new public adapter export without updating `scripts/verify-config-form-adapter-packages.mjs`.

