# CopyText

A copy-to-clipboard component with built-in loading, copied, and error feedback states.

## Basic Usage

:::demo Set `text` to the value that should be copied.
```vue
<script setup>
import { CopyText } from '@moluoxixi/components'
</script>

<template>
  <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
    <CopyText text="Hello, World!" />
    <CopyText text="npm install @moluoxixi/components" />
    <CopyText text="A longer piece of text to copy" />
  </div>
</template>
```
:::

## Custom Content

:::demo Use the default slot to customize the displayed text.
```vue
<script setup>
import { CopyText } from '@moluoxixi/components'
</script>

<template>
  <CopyText text="token-abc-123456-xyz">
    <template #default="{ text }">
      <code
        style="background:var(--el-fill-color-light,#f5f7fa);padding:2px 8px;border-radius:4px;font-size:13px;"
      >
        {{ text }}
      </code>
    </template>
  </CopyText>
</template>
```
:::

## Custom Icon

:::demo Use the `icon` slot to replace the button icon. The slot exposes the `copied`, `copying`, and `error` states.
```vue
<script setup>
import { CopyText } from '@moluoxixi/components'
</script>

<template>
  <CopyText text="custom-icon-example">
    <template #icon="{ copied }">
      <span style="font-size:13px;padding:0 4px;">
        {{ copied ? 'Done' : 'Copy' }}
      </span>
    </template>
  </CopyText>
</template>
```
:::

## Disabled

:::demo Set `disabled` to prevent copying.
```vue
<script setup>
import { CopyText } from '@moluoxixi/components'
</script>

<template>
  <div style="display:flex;gap:16px;">
    <CopyText text="Available" />
    <CopyText text="Disabled" :disabled="true" />
  </div>
</template>
```
:::
