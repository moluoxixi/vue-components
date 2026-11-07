# RequestSelectV2

A remote-data selector built on Element Plus `ElSelectV2`. It manages request, loading, caching, and error reporting states.

## Basic Usage

:::demo Provide an asynchronous `query` function and the component loads the options automatically.

```vue
<script setup lang="ts">
import { RequestSelectV2 } from '@moluoxixi/components'
import { ref } from 'vue'

interface UserOption {
  value: number
  label: string
}

const value = ref<number | null>(null)

async function queryUsers(): Promise<UserOption[]> {
  await new Promise<void>(resolve => setTimeout(resolve, 300))
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
<script setup lang="ts">
import { RequestSelectV2 } from '@moluoxixi/components'
import { ElSwitch } from 'element-plus'
import { ref } from 'vue'

interface ItemOption {
  value: number
  label: string
}

const value = ref<number | null>(null)
const enabled = ref<boolean>(false)

async function queryItems(): Promise<ItemOption[]> {
  await new Promise<void>(resolve => setTimeout(resolve, 200))
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

## Request and cache contract

Install `VueQueryPlugin` and a `QueryClient` in the application. query receives params and must return an option array. Unwrap `{ data: [...] }` responses inside query. The wrapper manages loading and emits error for rejected requests.

| Option                             | Default and behavior                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `query(params)`                    | Required asynchronous function returning an array, not a pagination envelope.                                       |
| `params`                           | Empty object by default; reactive changes trigger a query.                                                          |
| `enabled`                          | True by default. False pauses automatic fetching without disabling the control.                                     |
| `cacheKey`                         | Instance-isolated by default. Explicitly equal keys share a resource; never share a key across unrelated resources. |
| `staleTime`                        | Vue Query freshness duration; choose it for the business refresh policy.                                            |
| `v-model`                          | Uses the underlying control's single/multiple selection contract; does not automatically return full objects.       |
| `loaded(options)` / `error(error)` | Successful option array / request exception.                                                                        |
| `refetch()`                        | Exposed on a component ref for retries or refreshing after a business change.                                       |

Keep cacheKey and query stable during an instance lifetime; update filters through params. Shared caches must have matching queries, parameter semantics and response shapes. Refresh/invalidate caches after permission changes.

## Field mapping and interaction boundaries

The underlying control is `ElSelectV2` and the response array is bound to `options`. Typical fields are `value/label`; map custom fields through the underlying props option. Undeclared attributes such as clearable, filterable, multiple and placeholder, plus underlying events, are forwarded through attrs. Custom slots are not forwarded by this wrapper.

For server search, update params from input events; filterable alone is not server search. When a parent condition is cleared, also clear the selected value and pause fetching. Explain disabled business controls using an outer tooltip; enabled=false only affects requests.
