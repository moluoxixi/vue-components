# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Designer Drag Preview And Panel Visibility

Palette drag previews must not mutate the controlled `DesignerDocument`. A field material may create a temporary node
with `DesignerRegistry.createNode()` after `pointerdown`, then render that node through `DesignerNodePreview` in the
teleported pointer overlay. The overlay becomes visible only after the pointer moves beyond the drag threshold and must be
removed on `pointerup`, `pointercancel`, Sortable `onEnd`, readonly teardown, and component unmount.

Container materials must use a lightweight title/icon summary in this overlay. Do not eagerly mount every material's
runtime component in the palette: components such as tab panes require a runtime parent context and produce errors when
mounted independently. Keep `DesignerPalette.registry` optional so direct consumers of the public palette component remain
compatible.

```vue
<!-- Field material: real, lazily-created runtime preview -->
<DesignerNodePreview
  v-if="registry && preparedPreviewNode"
  :node="preparedPreviewNode"
  :registry="registry"
/>

<!-- Container material: context-safe drag summary -->
<span v-else>{{ materialTitle }}</span>
```

Desktop and medium side panels are independently collapsible. A hidden panel must have both `hidden` and `inert`; the
root exposes `data-palette-open` and `data-properties-open` so layout rules and regression tests consume the same state.
Narrow mode continues to use roving Palette / Canvas / Properties tabs instead of duplicating collapse controls.

Required regression coverage:

- Pointer movement below the threshold does not mount the teleported overlay.
- Dragging a field shows a runtime control in the overlay without emitting a document update before drop.
- Ending or cancelling the drag removes the overlay and global pointer listeners.
- Panel controls update `aria-expanded`, `hidden`, and `inert`, and restoring a panel preserves the canvas document.

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)
