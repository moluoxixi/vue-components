# RequestTreeSelect

封装 Element Plus `ElTreeSelect` 的远程数据树形选择器，自动处理请求和加载状态。

## 基础用法

:::demo 传入返回树形数据的 `query` 函数，组件自动填充树节点。
```vue
<script setup>
import { ref } from 'vue'
const value = ref(null)

async function queryDeptTree() {
  await new Promise(r => setTimeout(r, 200))
  return [
    { value: 1, label: '总公司', children: [
      { value: 2, label: '技术部', children: [
        { value: 4, label: '前端组' },
        { value: 5, label: '后端组' },
      ]},
      { value: 3, label: '产品部' },
    ]},
  ]
}
</script>
<template>
  <RequestTreeSelect
    v-model="value"
    :query="queryDeptTree"
    placeholder="请选择部门"
    style="width:240px;"
  />
</template>
```
:::

## API

<ApiDocs name="RequestTreeSelect" />
