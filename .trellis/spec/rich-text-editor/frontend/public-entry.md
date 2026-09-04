# Rich Text Editor Public Entry Contract

## 1. Scope / Trigger

Apply this contract when moving the editor component, changing its package root,
Vue plugin behavior, public types, package files, or stylesheet export.

## 2. Signatures

```ts
export const RichTextEditor: typeof RichTextEditorSource & Plugin
export default RichTextEditor

interface RichTextEditorExpose {
  editor: Editor | null
  focus: (position?: RichTextEditorAutofocus) => void
  clearContent: () => void
}
```

The stable import paths are:

```ts
import RichTextEditor, { RichTextEditor as RichTextEditorComponent } from '@moluoxixi/rich-text-editor'
import '@moluoxixi/rich-text-editor/styles'
```

## 3. Contracts

- `src/components/RichTextEditor/index.vue` owns the TipTap editor behavior.
  `src/components/RichTextEditor/index.ts` and `src/components/index.ts` are
  export-only barrels.
- The named export, default export, and component registered by
  `app.use(RichTextEditor)` are the same object. Installation registers the
  name `RichTextEditor`.
- Package root re-exports public types from `src/types`; composables and utils
  remain private implementation details.
- `exports["."].source` points to the root `index.ts`, so `package.json.files`
  includes `index.ts` and `src` in addition to `dist`.
- `./styles` resolves to `dist/rich-text-editor.css`, and CSS remains marked as
  a package side effect.
- Moving implementation never creates a forwarding `src/index.vue` shim.

## 4. Validation Matrix

| Condition | Required result |
| --- | --- |
| Named and default component imports | Resolve to the same component object |
| `app.use(RichTextEditor)` | Registers that object as `RichTextEditor` |
| Workspace uses the `source` condition | Resolves root `index.ts` and its `src` dependency graph |
| Published tarball uses runtime/types entries | Loads `dist/index.js` and `dist/index.d.ts` |
| Consumer imports `./styles` | Loads CSS containing `.mx-rich-text-editor` |
| Old `src/index.vue` path is imported | Reject; no compatibility shim exists |

## 5. Good / Base / Bad Cases

- Good: consumers import the component or install the default export through
  the package root and import styles through `./styles`.
- Base: a consumer uses the named component without plugin installation.
- Bad: a root entry creates separate wrapper objects for named and default
  exports, or a tarball omits files referenced by its source condition.

## 6. Tests Required

- Unit tests assert named/default identity, component name, and Vue plugin
  registration, then retain HTML, toolbar, readonly, disabled, and slot behavior.
- Typecheck and build verify the root-to-component barrel path and declaration
  graph.
- Packed Node/type/browser smoke verifies runtime, declarations, source files,
  and the stylesheet entry from the installed tarball.
- Package architecture must report no Rich Text Editor ownership debt.

## 7. Wrong vs Correct

Wrong:

```ts
export { default as RichTextEditor } from './src/index.vue'
```

Correct:

```ts
import { RichTextEditorSource } from './src/components'

export const RichTextEditor = Object.assign(RichTextEditorSource, { install })
export default RichTextEditor
```
