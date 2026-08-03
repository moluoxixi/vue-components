# Component Guidelines

> How components are built in this project.

---

## Overview

<!--
Document your project's component conventions here.

Questions to answer:
- What component patterns do you use?
- How are props defined?
- How do you handle composition?
- What accessibility standards apply?
-->

(To be filled by the team)

---

## Component Structure

<!-- Standard structure of a component file -->

(To be filled by the team)

---

## Props Conventions

<!-- How props should be defined and typed -->

(To be filled by the team)

---

## Styling Patterns

<!-- How styles are applied (CSS modules, styled-components, Tailwind, etc.) -->

(To be filled by the team)

---

## Accessibility

<!-- A11y requirements and patterns -->

(To be filled by the team)

---

## Scenario: Extract Vue component metadata for generated documentation

### 1. Scope / Trigger

- Apply this contract when `@moluoxixi/ai-doc-assistant` extracts a Vue SFC public API for generated component documentation.
- `vue-component-meta` remains the checker-backed source for props, emits, slots, exposed member types, and referenced type schemas.
- Source-level `defineExpose(...)` declarations are the authority for deciding which statically declared members belong in the generated Expose section.

### 2. Signatures

```ts
extractContracts(
  files: { exportName?: string; filePath: string; packageName: string }[],
  tsconfigPath?: string,
): Promise<ComponentContract[]>

interface ComponentContract {
  props: PropDef[]
  emits: EmitDef[]
  slots: SlotDef[]
  exposed?: ExposeDef[]
  typeDefs: TypeDefInfo[]
}
```

### 3. Contracts

- For a statically resolvable object or type-literal `defineExpose`, `ComponentContract.exposed` contains only the names declared by that macro.
- Do not render `ComponentMeta.exposed` directly as the source-level Expose section. Depending on the component shape and dependency version, it may include public-instance entries derived from props, listeners, or `$slots`.
- The current implementation reads statically declared expose names from the `<script setup>` TypeScript AST, then keeps the checker-derived types and descriptions for those names.
- If `defineExpose` is absent, omit the Expose section rather than synthesizing public-instance members.
- If the macro exists but its shape is dynamic and cannot be resolved safely, preserve the checker result instead of guessing member names. Add a regression fixture before changing this fallback.
- Downstream tooltip generation follows `typeRefs` transitively through `ComponentContract.typeDefs`; a referenced type's referenced project types must not be dropped.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| SFC cannot be read or analyzed | Throw an error with the component path; do not return a partial batch |
| Required documented component is missing | Documentation extraction exits non-zero and names every missing component |
| No `defineExpose` macro | `exposed` is omitted |
| Static object/type-literal macro | Keep only macro-declared names and checker-derived member metadata |
| Dynamic macro argument | Preserve checker output; do not apply lossy name subtraction |
| Referenced type has local transitive dependencies | Include all reachable definitions in expanded type details |

### 5. Good/Base/Bad Cases

- Good: a fixture combines a prop named `items`, emits, slots, and `defineExpose({ items: props.items, focus })`; Expose contains `items` and `focus`, while `$slots` and listeners are absent.
- Base: a component without `defineExpose` produces no Expose section.
- Bad: filtering `meta.exposed` by subtracting prop names removes the legitimate exposed `items` member.
- Bad: rendering all of `meta.exposed` can document props, listeners, or `$slots` as though they were declared by `defineExpose`.

### 6. Tests Required

- Extractor integration test with real `vue-component-meta`: assert the exact Expose name list for a mixed props/emits/slots/expose fixture.
- Regression assertion: a prop-named exposed member remains present.
- Regression assertion: synthetic `$slots`, listener, and prop-only instance entries remain absent.
- No-macro assertion: `ComponentContract.exposed` is omitted.
- Documentation extraction assertion or generated-data inspection: a direct type reference and at least one transitive project type definition appear in `typeDetail`.

### 7. Wrong vs Correct

#### Wrong

```ts
const exposed = mapMetaExposed(meta, collected)
// Treating every public-instance entry as a source defineExpose declaration.
contract.exposed = exposed
```

#### Correct

```ts
const metaExposed = mapMetaExposed(meta, collected)
const defineExposeNames = extractDefineExposeNames(filePath)
const exposed = defineExposeNames === null
  ? metaExposed
  : metaExposed.filter(member => defineExposeNames.includes(member.name))
```

---

## Common Mistakes

<!-- Component-related mistakes your team has made -->

(To be filled by the team)
