# ConfigForm Designer Quality Contracts

These contracts apply to Designer rendering, responsive workspace behavior,
focus migration, theme isolation, and runtime preview boundaries.

## Designer Drag Preview And Panel Visibility

The Design canvas must project a drag candidate into a `ProjectDraftSnapshot`, then render it through the same
`ConfigFormRenderer` and Component Registry used after commit. Candidate opacity and editor feedback belong to the editor
bridge or overlay; do not replace the candidate with a hand-built input, card, or size approximation. Pointer up submits
one semantic command. Pointer cancel, readonly teardown, and unmount discard the projection without changing host state.

The pointer-following drag visual is a sanitized clone of the rendered candidate DOM. Its width, height, and pointer
offset come from that measured candidate. Do not mount a second business component tree inside the fixed overlay. Empty
container hit areas and append positions are geometry-only overlays; they must not add a persistent trailing cell or
placeholder to Runtime layout.

`DesignerMaterialSpecimen` may lazily mount a visible palette item through `ConfigFormRenderer` with events intercepted by an
editor bridge. A material that cannot form a legal standalone projection must use its explicit unavailable/design-policy
state. It must not silently fall back to a fabricated control that suggests different props or dimensions. The specimen
root must carry both `aria-hidden="true"` and native `inert`; `aria-hidden` alone leaves real descendant inputs focusable
and creates an invalid accessibility tree.

```vue
<ConfigFormRenderer
  v-if="projection"
  v-model="specimenModel"
  :fields="projection.fields"
  :components="projection.components"
  :editor="editorBridge"
  mode="design"
/>
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

When `workspaceNavigation="external"`, the host navigation is authoritative for the narrow active view. A transition
from medium to narrow must not replace the host-selected Canvas with the currently open medium drawer or its focused
control. If the external view remains Canvas and focus was inside the drawer that becomes hidden, move focus to the
visible Canvas panel. Internal navigation may continue to derive its narrow view from the focused panel.

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
- An external-navigation regression opens the medium Properties drawer while the host still selects Canvas, resizes to
  narrow, and asserts that the host tab, `data-active-view`, visible panel, and focus target all resolve to Canvas.
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

Provider components may redeclare inherited custom properties on their own root. When a token does not affect the computed
style, override it on the provider root while retaining the Workbench theme and Inspector ancestors. Theme-switch
transitions must not create a low-contrast intermediate frame: disable the provider label transition or the editor surface
background transition at the narrowest owner instead of delaying axe or exempting the node.

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

Preview responsiveness must follow the actual Runtime stage's inline size, not only the browser viewport or the outer
scroll pane. A viewport selector can make `.preview-stage` narrower than `.preview-canvas`, so the stage owns the named
inline-size container. Container rules must reuse the Runtime renderer's variables rather than inventing a second layout:

```css
.preview-stage {
  container-name: preview-runtime;
  container-type: inline-size;
}

@container preview-runtime (max-width: 1024px) {
  .page-preview-form [data-config-form-responsive-layout] {
    --mx-config-form-active-columns: var(--mx-config-form-columns-tablet);
  }

  .page-preview-form [data-config-form-responsive-cell] {
    --mx-config-form-active-span: var(--mx-config-form-span-tablet);
  }
}
```

Use the same 1024px tablet and 720px mobile thresholds as Runtime. Designer-owned narrow Canvas adaptations continue to
follow `data-workspace-mode="narrow"`, which is derived from the Designer root width.

An overlay Preview must also be isolated from editor chrome. `.editor-pane` establishes a stacking context, while the
Preview is a higher sibling layer. Raising only the Preview's `z-index` is not sufficient because Designer selection,
resize, and drag descendants have their own high `z-index` values and can otherwise paint across the Preview.

Required regression coverage:

- Dark and light semantic text/control tokens meet the intended contrast thresholds.
- Every Provider selector or variable override remains below a themed Inspector scope.
- Axe runs immediately after theme switching and reports zero WCAG 2 A/AA violations; tests must not wait for an unsafe
  color transition to finish.
- Light Config export uses a light editor surface and readable text; Source Monaco follows the active IDE theme.
- At 1440px, 900px, and 390px, Workbench root width does not overflow; narrow Designer Canvas and Preview runtime grids do
  not overflow their own containers.
- At 900px, select a Canvas node before opening Preview, then interact with a real Preview provider control. The test must
  prove that the active columns/span equal the stage's mobile variables, all cells remain inside the stage, and Designer
  node actions do not intercept the Preview control.

---
