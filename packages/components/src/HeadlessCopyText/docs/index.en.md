# HeadlessCopyText

A headless copy primitive that provides state and clipboard logic while leaving all rendering to the default slot.

## Basic Usage

:::demo Receive the copy state from the default slot and fully control the rendered interface.

```vue
<script setup lang="ts">
import { HeadlessCopyText } from '@moluoxixi/components'
import { ElButton, ElTooltip } from 'element-plus'
</script>

<template>
  <HeadlessCopyText text="headless-copy-example">
    <template #default="{ text, copied, copying, error, copy, reset }">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:13px;color:#606266;">{{ text }}</span>
        <ElTooltip :disabled="!copying" content="Copying is in progress. Wait for completion before retrying.">
          <span>
            <ElButton
              size="small"
              :type="copied ? 'success' : 'primary'"
              :loading="copying"
              :disabled="copying"
              @click="copy().catch(() => undefined)"
            >
              {{ copied ? 'Copied' : 'Copy' }}
            </ElButton>
          </span>
        </ElTooltip>
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
        <ElButton v-else size="small" type="primary" @click="copy().catch(() => undefined)">Copy</ElButton>
      </div>
    </template>
  </HeadlessCopyText>
</template>
```

:::

## Slot and command contract

| Field                | Description                                                                       |
| -------------------- | --------------------------------------------------------------------------------- |
| `text` / `disabled`  | Current input text and disabled state.                                            |
| `copying` / `copied` | Pending/success state for loading and feedback.                                   |
| `error`              | Most recent Error, or null.                                                       |
| `copy(text?)`        | Copy props.text or a one-off override; returns a Promise that rejects on failure. |
| `reset()`            | Clear feedback without changing text or writing to the clipboard.                 |

No default button is rendered. `text` is required, `disabled` defaults to false and `resetDelay` defaults to 2000ms; zero disables automatic success reset. Events are `copy(text)` and `error(Error)`. A component ref also exposes copy/reset.

## Accessibility and failure handling

Use `copy().catch(...)` in event handlers and display slot.error or handle `@error`. Announce results with `aria-live="polite"`. When disabled or copying, wrap the button with an event-receiving element and show a tooltip with the reason and recovery condition.

Clipboard operations require browser permission and user interaction. This component supplies state and commands; it does not bypass permissions or write a clipboard during SSR.
