# RequestCascader

封装 Element Plus `ElCascader` 的远程数据级联选择器，自动处理请求和加载状态。

## 基础用法

:::demo 传入返回树形数据的 `query` 函数，组件自动填充级联选项。
```vue
<script setup lang="ts">
import { RequestCascader } from '@moluoxixi/components'
import { ref } from 'vue'
const value = ref([])

async function queryRegions() {
  await new Promise(r => setTimeout(r, 200))
  return [
    { value: '110000', label: '北京市', children: [
      { value: '110100', label: '北京市', children: [
        { value: '110101', label: '东城区' },
        { value: '110102', label: '西城区' },
      ]},
    ]},
    { value: '310000', label: '上海市', children: [
      { value: '310100', label: '上海市', children: [
        { value: '310101', label: '黄浦区' },
        { value: '310104', label: '徐汇区' },
      ]},
    ]},
  ]
}
</script>
<template>
  <RequestCascader
    v-model="value"
    :query="queryRegions"
    placeholder="请选择地区"
    style="width:280px;"
  />
</template>
```
:::
