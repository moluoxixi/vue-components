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
