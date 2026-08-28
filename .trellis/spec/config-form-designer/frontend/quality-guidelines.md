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

Workspace mode must be derived from the Designer root width observed by `ResizeObserver`, not from the browser viewport:

| Root width | Workspace contract |
| --- | --- |
| `> 1100px` | Desktop: Materials and Properties are independently collapsible docked panels. |
| `721..1100px` | Medium: Canvas occupies the only grid area; Materials and Properties are mutually exclusive, non-modal overlay drawers on the left and right edges. |
| `<= 720px` | Narrow: Palette / Canvas / Properties are roving workspace tabs and only the active tabpanel is visible. |

Medium drawers must not use a scrim, `aria-modal`, or make Canvas inert. Selecting a Canvas node while Properties is open
must keep the drawer open and update the inspector. Escape and the explicit close button close the drawer. Focus returns to
the toolbar trigger only when focus was still inside the closing drawer or on `body`; a Canvas selection keeps its focus.

A hidden workspace panel must have both `hidden` and `inert`, while remaining mounted so property-tab state, drafts, and
scroll position survive. The root exposes `data-workspace-mode`, `data-palette-open`, and `data-properties-open` so layout
rules and regression tests consume the same state.

Breakpoint changes must preserve a visible focus target:

- A medium toolbar trigger or drawer-only control maps to the corresponding narrow workspace tab.
- A narrow workspace tab maps to the equivalent desktop/medium toolbar trigger, except Canvas maps to the Canvas panel.
- A medium drawer-only control maps to the equivalent desktop toolbar trigger.
- A control inside a panel keeps focus when that panel remains visible in the destination mode.

Controls that are unmounted at a breakpoint, such as drawer close buttons, must carry a stable `data-drawer-control` marker.
Focus migration runs after Vue renders the destination mode; do not rely on the browser falling back to `body`.

Property fields use a stable vertical layout: the label is one line with ellipsis and a complete `title`/accessible name,
and the control occupies the next row at full available width. Properties owns vertical scrolling; setter lists must not add
a nested scroll container. Property view tabs require stable tab/tabpanel ids, `aria-controls`, `aria-labelledby`, hidden +
inert inactive panels, roving `tabindex`, and ArrowLeft/ArrowRight/Home/End navigation without document commands.

Required regression coverage:

- Pointer movement below the threshold does not mount the teleported overlay.
- Dragging a field shows a runtime control in the overlay without emitting a document update before drop.
- Ending or cancelling the drag removes the overlay and global pointer listeners.
- Panel controls update `aria-expanded`, `hidden`, and `inert`, and restoring a panel preserves the canvas document.
- Medium geometry proves Canvas and the open drawer share the workspace height and opening a drawer does not change the
  Designer height.
- Both Element Plus and Ant Design Vue cover medium drawer selection, Escape behavior, and horizontal overflow.
- Breakpoint tests focus a panel input, a narrow workspace tab, and a medium drawer-only control before resizing, then
  assert the resulting `document.activeElement` is visible and semantically equivalent.
- Property-tab tests cover both arrow directions including wraparound, Home/End, ARIA relationships, and absence of
  document update emissions.

---

## Editor Theme And Runtime Isolation

Workbench and Designer chrome must use semantic theme tokens. Runtime Canvas and Preview surfaces are a separate theme
boundary: changing the IDE theme must not recolor user components or exported pages. Keep explicit runtime tokens for the
canvas sheet, text, muted text, borders, and drag-preview surface instead of reusing dark editor surface tokens.

Provider controls rendered by the Inspector may receive dark-theme variables or component-class overrides only below the
Inspector scope. Never add global `.el-*`, `.ant-*`, `--el-*`, or provider theme rules at the Workbench root because Preview
renders the same providers as real Runtime output.

```css
/* Correct: affects generated Inspector controls only. */
.workbench-app[data-theme="dark"] .embedded-designer .mx-config-form-designer__properties {
  --el-text-color-primary: var(--mx-designer-text);
}

/* Wrong: also recolors Runtime components in Preview. */
.workbench-app[data-theme="dark"] {
  --el-text-color-primary: var(--wb-text);
}
```

Preview responsiveness must follow the Preview pane's inline size, not only the browser viewport. A resizable split pane can
be narrow on a wide screen. Establish an inline-size container on the Preview canvas and use a named `@container` query for
runtime layout adaptations. Designer-owned narrow Canvas adaptations continue to follow `data-workspace-mode="narrow"`,
which is derived from the Designer root width.

Required regression coverage:

- Dark and light semantic text/control tokens meet the intended contrast thresholds.
- Every Provider selector or variable override remains below the dark Inspector scope.
- Light Config export uses a light editor surface and readable text; Source Monaco follows the active IDE theme.
- At 1440px, 900px, and 390px, Workbench root width does not overflow; narrow Designer Canvas and Preview runtime grids do
  not overflow their own containers.

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
