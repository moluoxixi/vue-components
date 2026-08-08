# RequestSelectV2

A remote-data selector built on Element Plus `ElSelectV2`. It manages request, loading, caching, and error reporting states.

## Basic Usage

:::demo Provide an asynchronous `query` function and the component loads the options automatically.
```vue
<script setup>
import { RequestSelectV2 } from '@moluoxixi/components'
import { ref } from 'vue'
const value = ref(null)

async function queryUsers() {
  await new Promise(resolve => setTimeout(resolve, 300))
  return [
    { value: 1, label: 'Avery' },
    { value: 2, label: 'Blake' },
    { value: 3, label: 'Casey' },
    { value: 4, label: 'Drew' },
  ]
}
</script>
<template>
  <RequestSelectV2
    v-model="value"
    :query="queryUsers"
    cache-key="request-select-users-demo-en"
    placeholder="Select a user"
    style="width:240px;"
  />
</template>
```
:::

## Conditional Loading

:::demo When `enabled` is `false`, the request does not run. This is useful for dependent or conditionally rendered fields.
```vue
<script setup>
import { RequestSelectV2 } from '@moluoxixi/components'
import { ElSwitch } from 'element-plus'
import { ref } from 'vue'
const value = ref(null)
const enabled = ref(false)

async function queryItems() {
  await new Promise(resolve => setTimeout(resolve, 200))
  return Array.from({ length: 5 }, (_, index) => ({ value: index, label: `Option ${index + 1}` }))
}
</script>
<template>
  <div style="display:flex;flex-direction:column;gap:12px;">
    <ElSwitch v-model="enabled" active-text="Enable request" />
    <RequestSelectV2
      v-model="value"
      :query="queryItems"
      :enabled="enabled"
      cache-key="request-select-items-demo-en"
      placeholder="Select an option"
      style="width:240px;"
    />
  </div>
</template>
```
:::
