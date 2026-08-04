# Component Guidelines

> Concrete conventions for interactive documentation components and bounded API type overlays.

## Overlay Structure

Scrollable content belongs inside the overlay body, not on the positioned popper shell. Libraries such as Element Plus render an arrow outside the shell's content box; setting `overflow: auto` on that shell counts the arrow as overflow and can create a scrollbar even when the text fits.

```vue
<ElTooltip popper-class="mx-type-tooltip">
  <template #content>
    <span class="mx-type-tooltip-content">{{ detail }}</span>
  </template>
  <button type="button">{{ label }}</button>
</ElTooltip>
```

```css
.el-popper.mx-type-tooltip {
  max-width: min(560px, calc(100vw - 32px));
}

.mx-type-tooltip-content {
  display: block;
  max-height: min(440px, calc(100vh - 42px));
  overflow-x: hidden;
  overflow-y: auto;
  overflow-wrap: anywhere;
}
```

The trigger must remain keyboard focusable, expose an accessible name, open on focus, close on Escape, and support touch without removing hover behavior.

## Generated Type Summaries

API type tooltips are bounded summaries, not raw dumps of a complete workspace type graph.

- Preserve concise definitions verbatim.
- Order direct references before transitive references.
- Discover transitive references from structured field types and declaration inheritance. Do not scan JSDoc, field names, or arbitrary raw text as type edges.
- Summarize oversized object definitions by fields while retaining the declaration header and closing brace.
- Keep oversized non-object aliases as aliases; never rewrite a union or function alias as an object.
- Mark every truncation explicitly. Use a distinct message for a truncated type expression and omitted referenced definitions.
- Bound the complete rendered summary by both line count and character count.

## Required Tests

- A concise generic payload retains all fields and referenced aliases.
- Multiple oversized direct definitions remain present and syntactically closed.
- A field or JSDoc label matching another type name does not create a dependency.
- Long union aliases remain aliases and carry a truncation marker.
- Cyclic and duplicate references terminate and render each definition once.
- Desktop and narrow browser checks assert that the overlay stays in the viewport and that its content has no horizontal overflow.

## Common Mistakes

```css
/* Wrong: the arrow contributes to the shell's scroll area. */
.el-popper.mx-type-tooltip {
  overflow: auto;
}

/* Correct: only the content body owns fallback scrolling. */
.mx-type-tooltip-content {
  overflow-y: auto;
}
```

Do not hide a scrollbar while leaving an unbounded multi-thousand-line type dump behind it. Reduce the generated content structurally first, then keep inner scrolling only as a small-viewport fallback.
