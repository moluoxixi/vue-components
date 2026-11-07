# RequestTreeSelect

A remote-data tree selector built on Element Plus `ElTreeSelect`. It manages the request and loading state automatically.

## Basic Usage

:::demo Provide a `query` function that returns hierarchical data, and the component populates the tree nodes.

```vue
<script setup lang="ts">
import { RequestTreeSelect } from '@moluoxixi/components'
import { ref } from 'vue'

interface DepartmentNode {
  value: number
  label: string
  children?: DepartmentNode[]
}

const value = ref<number | null>(null)

async function queryDepartmentTree(): Promise<DepartmentNode[]> {
  await new Promise<void>(resolve => setTimeout(resolve, 200))
  return [
    {
      value: 1,
      label: 'Head Office',
      children: [
        {
          value: 2,
          label: 'Engineering',
          children: [
            { value: 4, label: 'Frontend' },
            { value: 5, label: 'Backend' },
          ],
        },
        { value: 3, label: 'Product' },
      ],
    },
  ]
}
</script>
<template>
  <RequestTreeSelect
    v-model="value"
    :query="queryDepartmentTree"
    placeholder="Select a department"
    style="width:240px;"
  />
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

The underlying control is `ElTreeSelect` and the response array is bound to `data`. Typical fields are `value/label/children`; map custom fields through the underlying props option and preserve children for hierarchical data. Undeclared attributes such as clearable, filterable, multiple and placeholder, plus underlying events, are forwarded through attrs. Custom slots are not forwarded by this wrapper.

For server search, update params from input events; filterable alone is not server search. When a parent condition is cleared, also clear the selected value and pause fetching. Explain disabled business controls using an outer tooltip; enabled=false only affects requests.

Use node-key for stable node identity and check-strictly for independent parent selection. Multiple selection uses an array model. Initial display requires selected nodes in data; lazy/unloaded node labels need application-provided data.
