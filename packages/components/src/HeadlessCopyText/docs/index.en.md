# HeadlessCopyText

A headless copy primitive that provides state and clipboard logic while leaving all rendering to the default slot.

## Basic Usage

:::demo Receive the copy state from the default slot and fully control the rendered interface.
```vue
<script setup lang="ts">
import { HeadlessCopyText } from '@moluoxixi/components'
import { ElButton } from 'element-plus'
</script>

<template>
  <HeadlessCopyText text="headless-copy-example">
    <template #default="{ text, copied, copying, error, copy, reset }">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:13px;color:#606266;">{{ text }}</span>
        <ElButton
          size="small"
          :type="copied ? 'success' : 'primary'"
          :loading="copying"
          :disabled="copying"
          @click="copy()"
        >
          {{ copied ? 'Copied' : 'Copy' }}
        </ElButton>
        <ElButton v-if="copied" size="small" @click="reset()">Reset</ElButton>
        <span v-if="error" style="color:#f56c6c;font-size:12px;">Failed</span>
      </div>
    </template>
  </HeadlessCopyText>
</template>
```
:::

## Animated Feedback

:::demo Use the `copied` state to implement custom feedback and transitions.
```vue
<script setup lang="ts">
import { HeadlessCopyText } from '@moluoxixi/components'
import { ElButton, ElTag } from 'element-plus'
</script>

<template>
  <HeadlessCopyText text="animated-feedback-example">
    <template #default="{ text, copied, copy }">
      <div style="display:inline-flex;gap:8px;align-items:center;">
        <code style="background:#f5f7fa;padding:2px 8px;border-radius:4px;font-size:13px;">
          {{ text }}
        </code>
        <ElTag v-if="copied" type="success" effect="light">Copied</ElTag>
        <ElButton v-else size="small" type="primary" @click="copy()">Copy</ElButton>
      </div>
    </template>
  </HeadlessCopyText>
</template>
```
:::
