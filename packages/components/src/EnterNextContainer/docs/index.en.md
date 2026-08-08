# EnterNextContainer

A keyboard navigation container that moves focus to the next input when Enter or an arrow key is pressed. It is useful for fast data-entry workflows.

## Basic Usage

:::demo Place input controls inside the container and press Enter to move to the next control.
```vue
<script setup>
import { EnterNextContainer } from '@moluoxixi/components'
import { ElInput } from 'element-plus'
</script>

<template>
  <EnterNextContainer>
    <div style="display:flex;flex-direction:column;gap:12px;max-width:320px;">
      <ElInput placeholder="Name (press Enter for the next field)" />
      <ElInput placeholder="Phone" />
      <ElInput placeholder="Email" />
      <ElInput placeholder="Notes" type="textarea" :rows="2" />
    </div>
  </EnterNextContainer>
</template>
```
:::

## Initial Focus

:::demo Use `focusNum` to select the control that receives focus after mounting. The index starts at 1.
```vue
<script setup>
import { EnterNextContainer } from '@moluoxixi/components'
import { ElInput } from 'element-plus'
</script>

<template>
  <EnterNextContainer :focus-num="2">
    <div style="display:flex;flex-direction:column;gap:12px;max-width:320px;">
      <ElInput placeholder="First field" />
      <ElInput placeholder="Second field (focused by default)" />
      <ElInput placeholder="Third field" />
    </div>
  </EnterNextContainer>
</template>
```
:::
