# CopyText

A copy-to-clipboard component with built-in loading, copied, and error feedback states.

## Basic Usage

:::demo Set `text` to the value that should be copied.

```vue
<script setup lang="ts">
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
<script setup lang="ts">
import { CopyText } from '@moluoxixi/components'
</script>

<template>
  <CopyText text="token-abc-123456-xyz">
    <template #default="{ text }">
      <code style="background:var(--el-fill-color-light,#f5f7fa);padding:2px 8px;border-radius:4px;font-size:13px;">
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
<script setup lang="ts">
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
<script setup lang="ts">
import { CopyText } from '@moluoxixi/components'
import { ElTooltip } from 'element-plus'
</script>

<template>
  <div style="display:flex;gap:16px;">
    <CopyText text="Available" />
    <ElTooltip content="Copying is disabled in this example. Enable the control to copy.">
      <span>
        <CopyText text="Disabled" :disabled="true" />
      </span>
    </ElTooltip>
  </div>
</template>
```

:::

## State, events and methods

| Interface                         | Behavior                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `text`                            | Required plain text written to the clipboard. Custom display content does not change it.                   |
| `disabled`                        | Defaults to false. Explain business restrictions and recovery conditions in an outer tooltip.              |
| `resetDelay`                      | Defaults to 2000ms. Zero retains success state until the next command or manual reset.                     |
| `copyLabel` / `copiedLabel`       | Accessible button names/tooltips, defaulting to “复制” / “已复制”.                                         |
| `copy` / `error` events           | Successful text / Error.                                                                                   |
| `copy(text?)` / `reset()` methods | Available on a component ref. Catch the Promise returned by copy; reset only clears feedback.              |
| Default / `icon` slots            | Default receives text; icon receives copied, copying, error, copy, reset and the remaining headless state. |

## Errors and usage boundaries

Clipboard access depends on browser security, permissions and a user gesture. Do not copy automatically on mount. The built-in button catches rejection and emits error; handle `@error` for application feedback. Calls through a ref still need a catch handler. Empty text is a valid clipboard value.

Preserve an accessible name when replacing icons. Explain pending copies and prevent repeated commands. Use HeadlessCopyText when the default visual layout does not fit your application.
