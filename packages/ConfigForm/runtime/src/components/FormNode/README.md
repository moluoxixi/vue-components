# FormNode

Internal node renderer for ConfigForm.

## Public contract

- `field`: resolved node returned by runtime transform
- `componentAttrs`: merged attrs passed to the final Vue component
- `componentListeners`: merged listeners converted to Vue handler props

## Behavior

- Plain Vue components are rendered with `h(component, attrs, slots)`
- Render-function components are called with a `RenderContext`
- Slot render functions receive `(context, ...slotArgs)`
- Nested slot nodes continue through `RecursiveField`

