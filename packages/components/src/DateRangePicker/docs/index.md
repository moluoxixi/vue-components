# DateRangePicker

对 Element Plus `ElDatePicker` 的业务层封装，统一输出格式、内置初始范围生成、支持日期边界禁用。

## 基础用法

:::demo 单日期选择，`v-model` 绑定日期字符串。
```vue
<script setup lang="ts">
import { DateRangePicker } from '@moluoxixi/components'
import { ref } from 'vue'
const date = ref('')
</script>
<template>
  <div>
    <DateRangePicker v-model="date" type="date" />
    <p style="margin-top:8px;color:#909399;font-size:13px;">当前值：{{ date || '—' }}</p>
  </div>
</template>
```
:::

## 日期范围

:::demo `type="daterange"` 开启范围模式，`v-model` 为 `[start, end]` 字符串数组。
```vue
<script setup lang="ts">
import { DateRangePicker } from '@moluoxixi/components'
import { ref } from 'vue'
const range = ref([])
</script>
<template>
  <div>
    <DateRangePicker v-model="range" type="daterange" />
    <p style="margin-top:8px;color:#909399;font-size:13px;">
      {{ range.length ? range.join(' ~ ') : '—' }}
    </p>
  </div>
</template>
```
:::

## 日期时间范围

:::demo `type="datetimerange"` 支持精确到秒，`shortcuts` 快捷选项。
```vue
<script setup lang="ts">
import { DateRangePicker } from '@moluoxixi/components'
import { ref } from 'vue'
const range = ref([])

function addDays(days) {
  const value = new Date()
  value.setDate(value.getDate() + days)
  return value
}

function monthBoundary(end) {
  const value = new Date()
  value.setMonth(value.getMonth() + (end ? 1 : 0), end ? 0 : 1)
  value.setHours(end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, 0)
  return value
}

const shortcuts = [
  { text: '最近7天', value: () => [addDays(-6), new Date()] },
  { text: '最近30天', value: () => [addDays(-29), new Date()] },
  { text: '本月', value: () => [monthBoundary(false), monthBoundary(true)] },
]
</script>
<template>
  <div>
    <DateRangePicker v-model="range" type="datetimerange" :shortcuts="shortcuts" />
    <p style="margin-top:8px;color:#909399;font-size:13px;">
      {{ range.length ? range.join(' ~ ') : '—' }}
    </p>
  </div>
</template>
```
:::

## 初始偏移范围

:::demo 用 `dateRange` 设置初始默认范围（相对于今天的偏移天数）。
```vue
<script setup lang="ts">
import { DateRangePicker } from '@moluoxixi/components'
import { ref } from 'vue'
const range = ref([])
</script>
<template>
  <DateRangePicker
    v-model="range"
    type="daterange"
    :date-range="[-6, 0]"
  />
</template>
```
:::
