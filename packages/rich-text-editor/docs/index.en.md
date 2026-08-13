# RichTextEditor

A ready-to-use rich text editor with formatting, links, lists, alignment, and history controls. Bind the HTML value with `v-model`.

## Basic Usage

:::demo `v-model` provides two-way binding for the HTML string. The toolbar includes common formatting actions.
```vue
<script setup lang="ts">
import { RichTextEditor } from '@moluoxixi/rich-text-editor'
import { ref } from 'vue'

const content = ref('<p>Start writing here...</p>')
</script>
<template>
  <RichTextEditor v-model="content" placeholder="Enter content" />
  <div style="margin-top:12px;font-size:12px;color:#999;">
    HTML output: {{ content.slice(0, 80) }}...
  </div>
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

const content = ref('<h2>Quarterly release notes</h2><p>This release includes <strong>batch processing</strong> and permission-audit improvements.</p>')
const disabled = ref(false)
const readonly = ref(false)
</script>
<template>
  <div style="display:flex;gap:20px;margin-bottom:12px;">
    <label style="display:inline-flex;align-items:center;gap:8px;">
      Disabled <ElSwitch v-model="disabled" />
    </label>
    <label style="display:inline-flex;align-items:center;gap:8px;">
      Read-only <ElSwitch v-model="readonly" />
    </label>
  </div>
  <RichTextEditor
    v-model="content"
    :disabled="disabled"
    :readonly="readonly"
    :max-height="300"
    min-height="160px"
  />
</template>
```
:::
