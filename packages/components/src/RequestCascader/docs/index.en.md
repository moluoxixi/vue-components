# RequestCascader

A remote-data cascader built on Element Plus `ElCascader`. It manages the request and loading state automatically.

## Basic Usage

:::demo Provide a `query` function that returns hierarchical data, and the component populates the cascader options.

```vue
<script setup lang="ts">
import { RequestCascader } from '@moluoxixi/components'
import { ref } from 'vue'

interface RegionOption {
  value: string
  label: string
  children?: RegionOption[]
}

const value = ref<string[]>([])

async function queryRegions(): Promise<RegionOption[]> {
  await new Promise<void>(resolve => setTimeout(resolve, 200))
  return [
    {
      value: 'us',
      label: 'United States',
      children: [
        {
          value: 'ca',
          label: 'California',
          children: [
            { value: 'sf', label: 'San Francisco' },
            { value: 'la', label: 'Los Angeles' },
          ],
        },
      ],
    },
    {
      value: 'gb',
      label: 'United Kingdom',
      children: [{ value: 'england', label: 'England', children: [{ value: 'london', label: 'London' }] }],
    },
  ]
}
</script>
<template>
  <RequestCascader v-model="value" :query="queryRegions" placeholder="Select a region" style="width:280px;" />
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

The underlying control is `ElCascader` and the response array is bound to `options`. Typical fields are `value/label/children`; map custom fields through the underlying props option and preserve children for hierarchical data. Undeclared attributes such as clearable, filterable and placeholder, plus underlying events, are forwarded through attrs. Custom slots are not forwarded by this wrapper.

For server search, update params from input events; filterable alone is not server search. When a parent condition is cleared, also clear the selected value and pause fetching. Explain disabled business controls using an outer tooltip; enabled=false only affects requests.

`props.emitPath=false` binds the leaf value; path mode binds the full path. `props.checkStrictly=true` permits intermediate nodes and `props.multiple` enables multiple selection. Model value types must match node values.
