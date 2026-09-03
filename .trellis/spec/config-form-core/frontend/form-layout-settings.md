# ConfigForm Form Layout Settings Contract

## 1. Scope / Trigger

This contract applies whenever Project Model form settings, Designer form
controls, Canonical compilation, Vue runtime binding, ConfigFormRenderer
layout, or standalone Source export changes `gap`, `labelWidth`, `columns`,
`fieldSpan`, or responsive overrides.

## 2. Signatures

```ts
interface FormSettings {
  columns?: number
  fieldSpan?: number
  gap?: string
  labelPosition?: 'left' | 'top'
  labelWidth?: number
  responsive?: {
    tablet?: { columns?: number, fieldSpan?: number, labelWidth?: number }
    mobile?: { columns?: number, fieldSpan?: number, labelWidth?: number }
  }
}
```

- `gap` is serialized as a canonical non-negative integer px string from
  `0px` through `64px`.
- `labelWidth` is a finite integer px value from `0` through `480`.
- Columns and field spans are integers from `1` through `24`.

## 3. Contracts

- The Project Model schema is the validation owner. JSON import, page transfer,
  semantic transactions, hashing, compilation, and export consume the same
  `FormSettings` value.
- Designer numeric controls may display the numeric part of a px setting, but
  they must serialize `unit: 'px'` values before emitting the model command.
- New Workbench templates use `gap: '16px'`, Desktop `labelWidth: 120`,
  Tablet `labelWidth: 96`, and Mobile `labelWidth: 72`.
- The Vue backend explicitly forwards `labelWidth` to
  `ConfigFormRenderer`; relying on structural spreading is forbidden at this
  boundary.
- Left labels use the active breakpoint label width followed by
  `minmax(0, 1fr)`. Tablet inherits Desktop and Mobile inherits Tablet when
  an override is absent. Missing width preserves `max-content`. Top labels
  remain a single-column field layout.
- Runtime and standalone Source emit Desktop/Tablet/Mobile label-width CSS
  variables and switch the active value through the same media/container
  breakpoints used for columns and spans.
- A field span displayed by Designer cannot exceed the active column count.
  Reducing columns clamps field span in the same command for desktop, tablet,
  and mobile settings.
- Standalone Source export must reproduce gap, label position, and label width;
  Config export preserves the canonical `form` object.

## 4. Validation & Error Matrix

| Input | Required result |
| --- | --- |
| `gap: '16px'` | Accept |
| `gap: '1rem'`, `'-1px'`, or `'65px'` | Reject at Model schema |
| `labelWidth: 0..480` integer | Accept |
| Negative, fractional, non-finite, or >480 label width | Reject at Model schema |
| `fieldSpan > columns` entered in Designer | Clamp to columns in the same command |
| Missing `labelWidth` in an existing current document | Preserve `max-content` Runtime behavior |
| `labelPosition: 'top'` with label width | Preserve value but do not apply a fixed label column |
| Tablet/Mobile label width missing | Inherit the previous breakpoint's resolved value |

## 5. Good / Base / Bad Cases

- Good: `ElInputNumber` displays `16`; Designer emits `{ gap: '16px' }`.
- Good: changing tablet columns from 12 to 4 emits tablet
  `{ columns: 4, fieldSpan: 4 }`.
- Good: one shared breakpoint component renders Columns, Field span, and Label
  width in the same order for Desktop, Tablet, and Mobile.
- Base: a current document omits `labelWidth` and keeps content-sized labels.
- Bad: storing arbitrary CSS such as `gap: '1rem 2vw'` in Project JSON.
- Bad: adding `labelWidth` to Model while omitting the Vue backend whitelist.
- Bad: showing field span 12 while the active layout resolves to 6 columns.
- Bad: rendering three visually similar breakpoint editors from separate DOM
  and setter implementations.

## 6. Tests Required

- Model tests accept canonical values and reject every error-matrix boundary.
- Designer tests prove px number serialization, integer precision, min/max
  props, same-command field span clamping, and identical three-breakpoint DOM.
- Runtime tests prove reactive left/top layout behavior, including `0px`.
- Runtime and Source tests prove breakpoint label-width inheritance and active
  CSS variable switching.
- Vue backend tests prove the value survives Canonical IR binding.
- Workbench template and Source export tests prove defaults and generated CSS.
- Browser tests use real Element Plus controls, verify responsive control
  geometry/ARIA ranges, and inspect the Design Runtime layout after commit.

## 7. Wrong vs Correct

Wrong:

```ts
formSetter('gap', 'Gap', 'text')
emit('updateForm', { gap: userInput })
```

Correct:

```ts
formSetter('gap', 'Gap (px)', 'number', undefined, {
  integer: true,
  min: 0,
  max: FORM_GAP_MAX_PX,
  unit: 'px',
})
// The Designer setter boundary serializes 16 to '16px'.
```
