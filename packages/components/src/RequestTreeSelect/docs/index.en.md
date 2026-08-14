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
