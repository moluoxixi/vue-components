# RichTextEditor

A ready-to-use rich text editor with formatting, links, lists, alignment, and history controls. Bind the HTML value with `v-model`.

## Basic Usage

:::demo `v-model` provides two-way binding for the HTML string. The toolbar includes common formatting actions.

```vue
<script setup lang="ts">
import { RichTextEditor } from '@moluoxixi/rich-text-editor'
import { ref } from 'vue'

const content = ref<string>('<p>Start writing here...</p>')
</script>
<template>
  <RichTextEditor v-model="content" placeholder="Enter content" />
  <div style="margin-top:12px;font-size:12px;color:#999;">HTML output: {{ content.slice(0, 80) }}...</div>
</template>
```

:::

## Disabled and Read-Only

:::demo Use `disabled` and `readonly` to control whether the content can be edited.

```vue
<script setup lang="ts">
import { RichTextEditor } from '@moluoxixi/rich-text-editor'
import { ElSwitch } from 'element-plus'
import { ref } from 'vue'

const content = ref<string>(
  '<h2>Quarterly release notes</h2><p>This release includes <strong>batch processing</strong> and permission-audit improvements.</p>',
)
const disabled = ref<boolean>(false)
const readonly = ref<boolean>(false)
</script>
<template>
  <div style="display:flex;gap:20px;margin-bottom:12px;">
    <label style="display:inline-flex;align-items:center;gap:8px;"> Disabled <ElSwitch v-model="disabled" /> </label>
    <label style="display:inline-flex;align-items:center;gap:8px;"> Read-only <ElSwitch v-model="readonly" /> </label>
  </div>
  <RichTextEditor v-model="content" :disabled="disabled" :readonly="readonly" :max-height="300" min-height="160px" />
</template>
```

:::

## Installation and Styles

Install Vue 3.5+ and matching versions of the five TipTap peers: `@tiptap/core`, `@tiptap/vue-3`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-text-align`. The package is ESM-only. Always import `@moluoxixi/rich-text-editor/styles`. Default/named exports refer to the same component; `app.use(RichTextEditor)` registers RichTextEditor.

## HTML and JSON

`v-model` remains an HTML string; empty output is `''`. Only schema-supported HTML is retained, so output is normalized.

Use `v-model:json-value` for a TipTap JSON document. When defined, JSON is the sole input source; edits emit both HTML and JSON. Set jsonValue to undefined to resume HTML input. Deep JSON mutations are observed. Equivalent documents preserve selection; external replacements do not emit updates or add an undo step.

Invalid JSON emits `contentError(Error)` and preserves the current document (empty on an invalid initial value). Stored document versions and schema migrations belong to the consuming application.

```vue
<script setup lang="ts">
import type { JSONContent } from '@tiptap/core'
import { RichTextEditor } from '@moluoxixi/rich-text-editor'
import { ref } from 'vue'
import '@moluoxixi/rich-text-editor/styles'
const document = ref<JSONContent>({ type: 'doc', content: [{ type: 'paragraph' }] })
</script>
<template><RichTextEditor v-model:json-value="document" /></template>
```

## Props

| Prop                  | Type                               | Default / behavior                                                    |
| --------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| modelValue            | string                             | Empty string; HTML                                                    |
| jsonValue             | JSONContent                        | Undefined; takes precedence over HTML                                 |
| placeholder           | string                             | Chinese placeholder; reactive                                         |
| disabled              | boolean                            | false; disables editing and high-level mutation commands              |
| readonly              | boolean                            | false; selectable content, hidden toolbar, mutation commands disabled |
| showToolbar           | boolean                            | true; hiding also closes the link panel                               |
| toolbarItems          | readonly RichTextEditorCommandId[] | All commands, ordered subset; block select/link entry remain          |
| extensions            | Extensions                         | Creation-only additional Extension/Node/Mark instances                |
| minHeight / maxHeight | number or string                   | 180 / unset; numbers are pixels                                       |
| ariaLabel             | string                             | Chinese editor accessible name                                        |
| autofocus             | boolean, start, end, all or number | false; creation only                                                  |

Extension names must be unique, including nested extensions and built-in names. Duplicates throw explicitly. Extensions are not hot-swapped: migrate the content and change the Vue key to rebuild the schema.

## Events

| Event             | Payload             | Trigger                                       |
| ----------------- | ------------------- | --------------------------------------------- |
| update:modelValue | HTML string         | Document mutation                             |
| update:jsonValue  | JSONContent         | Document mutation while JSON model is enabled |
| change            | HTML string, Editor | Document mutation                             |
| focus / blur      | FocusEvent, Editor  | Editable surface focus                        |
| contentError      | Error               | Invalid initial/external JSON                 |

Selection, placeholder, ARIA, disabled and readonly changes do not emit content updates.

## Commands and State

The component ref (`RichTextEditorExpose`) exposes:

- `commands.execute(id)`, `canExecute(id)`, `isActive(id)`.
- `commands.setBlockType('paragraph' | 'heading-1' | 'heading-2' | 'heading-3')`.
- `commands.setLink(href)`, `removeLink()`, `clearContent()`.
- `commands.undo()`, `redo()`, `toggleBold()`, `toggleItalic()`, `toggleUnderline()`.
- `state`: ready, editable, blockType, blocks, commands[id].active/enabled, link.
- `getHTML()`, `getJSON()`, `focus(position?)` and legacy `clearContent()`.

Mutations return boolean and re-check editable state and TipTap capability before executing. They return false when disabled, readonly, destroyed or unsupported by the selection. Keep reading the reactive state getter rather than caching a destructured snapshot.

Command IDs: undo, redo, bold, italic, underline, strike, code, bulletList, orderedList, blockquote, horizontalRule, alignLeft, alignCenter, alignRight, clearFormatting.

The raw `editor: Editor | null` and Editor event arguments remain compatibility escape hatches. Direct Editor access can bypass component mutation/content policy; ordinary business controls should use commands.

## Toolbar Slots

`toolbar` replaces default controls. `toolbar-before` and `toolbar-after` append controls while retaining the defaults. All receive `{ editor, disabled, readonly, commands, state, openLinkPanel }`.

```vue
<RichTextEditor v-model="content" :toolbar-items="['undo', 'redo', 'bold']">
  <template #toolbar-after="{ commands, state }">
    <button type="button" :disabled="!state.editable" @click="commands.clearContent()">Clear</button>
  </template>
</RichTextEditor>
```

Custom buttons must use type=button. openLinkPanel reuses the built-in link workflow. The link panel never creates a nested form; Enter applies and Escape closes/restores focus.

## Link Policy

Typing, HTML parsing, paste and autolink share the same policy: http/https/mailto/tel, fragments and root-relative paths are allowed. Protocol-relative URLs, backslashes, control characters and HTTP credentials are rejected. Bare domains gain https. Invalid input preserves the previous link and shows an error; empty input or removeLink removes it. Invalid JSON link attributes cause contentError.

Serialized HTML is not a general-purpose sanitizer. Custom extensions, server persistence and display surfaces still own their trust and sanitization policies.

## Compatibility and Validation

The current matrix validates matching TipTap 3.29.0, 3.29.2 and 3.31.3 packages with Vue 3.5.33; it does not claim future 3.x releases have been tested. Pin production versions and run the matrix before upgrading.

Run package test, typecheck and build, then `pnpm --filter @moluoxixi/rich-text-editor test:consumer`. The latter installs a real tarball and checks Node/SSR, strict NodeNext types, Vite, desktop/mobile Chromium, CSS, focus, host forms and editable transitions. Results, lockfiles and screenshots are under .playwright/consumer-report. SSR renders the shell; the interactive editor mounts on the client.
