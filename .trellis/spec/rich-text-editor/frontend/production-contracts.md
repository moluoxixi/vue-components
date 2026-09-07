# Rich Text Production Contracts

## 1. Scope / Trigger

Apply to controller lifecycle, toolbar commands/state, content models, extensions,
links, private child components and installed-consumer verification.

## 2. Signatures

```ts
interface RichTextEditorProps {
  modelValue?: string
  jsonValue?: JSONContent
  extensions?: Extensions
  toolbarItems?: readonly RichTextEditorCommandId[]
}
commands.execute(id): boolean
commands.setBlockType(type): boolean
commands.setLink(href): boolean
state.commands[id]: { active: boolean, enabled: boolean }
emit('contentError', error: Error)
```

The complete public contracts live in src/types and are re-exported at package root.
The legacy editor/focus/clearContent API stays compatible.

## 3. Contracts

- services/toolbar-commands.ts is the sole owner of built-in command chains.
  Dry runs use editor.can().chain() without focus; execution re-checks editable
  and capability. Ordinary UI consumes commands and a reactive state snapshot.
- use-rich-text-editor-toolbar subscribes to transaction/update/destroy and
  unregisters listeners on replacement/unmount. Editable refresh runs after
  controller.setEditable; synchronous refresh before it causes stale disabled UI.
  Equal UI snapshots retain object identity; do not serialize full documents for
  selection-only transactions.
- jsonValue, when defined, is the only controlled input. Output still emits HTML
  and JSON. Clearing jsonValue restores HTML input. Deep JSON changes are observed.
- Parse HTML through TipTap schema, JSON through schema.nodeFromJSON/check.
  Compare Node.eq before replacing; replacements use preventUpdate and
  addToHistory=false. Invalid JSON reports contentError and preserves the document.
- Empty HTML is ''. Empty JSON retains schema default attributes, including
  paragraph.textAlign=null with the built-in TextAlign extension.
- extensions are creation-only and may include Node/Mark/Extension. Flatten and
  reject duplicate names (including nested defaults); schema changes require
  explicit remount and application-owned content migration.
- isAllowedHref is shared with TipTap link isAllowedUri (input, import, paste,
  autolink). JSON links are validated before replacement. Invalid typed links
  must not be treated as a request to remove an existing link.
- Link panel is a role=group, not a nested form. Enter ignores IME confirmation;
  Escape restores focus. Hidden toolbar, readonly/disabled, document or selection
  change cancels pending link edits.
- Private toolbar/link components belong below RichTextEditor/components.
  Shared prefixed CSS is included by the root SFC from src/styles/editor.css:
  parent scoped CSS does not style descendants of extracted components.
- Raw Editor is a documented compatibility escape hatch, not a security boundary.
  Custom extensions/storage/display still own their trust policies.
- Consumer reports belong under .playwright, never dist (which is published).

## 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| HTML and JSON both provided | JSON input takes precedence, edits output both |
| Equivalent HTML/JSON input | Selection unchanged, no echo |
| Invalid initial JSON | Empty editor plus contentError |
| Invalid subsequent JSON | Preserve current doc plus contentError |
| Disabled/readonly/stale commands | false, no document mutation |
| Capability check | No transaction/focus mutation |
| Duplicate extension name | Explicit initialization error |
| Illegal link | Error/preserve existing mark; reject JSON or strip imported mark |
| Editor destroyed | ready=false; high-level commands return false |
| Extracted toolbar | 30px buttons in installed browser CSS |
| Packed consumer matrix | Exact aligned TipTap dependency tuple, no mixed versions |

## 5. Good / Base / Bad Cases

- Good: toolbar-after consumes commands/state while retaining default controls.
- Base: HTML v-model and default toolbar with explicit styles import.
- Bad: a custom business button mutates raw editor while disabled.
- Bad: testing source registration alone to claim an extension can roundtrip content.
- Bad: checking a CSS selector string instead of computed browser dimensions.

## 6. Tests Required

Run package lint/typecheck/test/build and pnpm test:package-architecture.
Unit contracts cover real commands, selection state, JSON feedback/errors, deep
updates, extension Node/Mark roundtrips, URL input/import, IME Enter and teardown.

Run pnpm --filter @moluoxixi/rich-text-editor test:consumer after build. It installs
a tarball for TipTap 3.29.0, 3.29.2 and 3.31.3, with exact transitive TipTap overrides.
Assert Node/SSR, strict NodeNext types, Vite, computed CSS, focus, host form,
editable transitions, desktop/mobile and axe checks. Version upgrades update
this explicit matrix; future 3.x support is not inferred from a caret range.

## 7. Wrong vs Correct

Wrong: button disabled only by props.disabled; execute calls a can() dry run.
Correct: disabled=!state.commands.bold.enabled; click=commands.execute('bold').

Wrong: invalid normalizeHref returns '' then unconditionally removes the link.
Correct: distinguish an empty user field from invalid non-empty input.

Wrong: package-wide sibling private components styled only by a parent's scoped CSS.
Correct: single-parent child components plus prefixed shared CSS and browser assertions.
