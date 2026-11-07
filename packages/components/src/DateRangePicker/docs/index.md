# DateRangePicker

对 Element Plus `ElDatePicker` 的业务层封装，统一输出格式、内置初始范围生成、支持日期边界禁用。

## 基础用法

:::demo 单日期选择，`v-model` 绑定日期字符串。

```vue
<script setup lang="ts">
import { DateRangePicker } from '@moluoxixi/components'
import { ref } from 'vue'
const date = ref<string>('')
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
const range = ref<string[]>([])
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
import type { DateRangePickerShortcut } from '@moluoxixi/components'
import { DateRangePicker } from '@moluoxixi/components'
import { ref } from 'vue'
const range = ref<string[]>([])

function addDays(days: number): Date {
  const value = new Date()
  value.setDate(value.getDate() + days)
  return value
}

function monthBoundary(end: boolean): Date {
  const value = new Date()
  value.setMonth(value.getMonth() + (end ? 1 : 0), end ? 0 : 1)
  value.setHours(end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, 0)
  return value
}

const shortcuts: DateRangePickerShortcut[] = [
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
const range = ref<string[]>([])
</script>
<template>
  <DateRangePicker v-model="range" type="daterange" :date-range="[-6, 0]" />
</template>
```

:::

## 输入、输出与初始化

| 配置                                  | 契约                                                                |
| ------------------------------------- | ------------------------------------------------------------------- |
| `v-model`                             | 单值或范围数组；输出统一为字符串或字符串数组。                      |
| `format`                              | 输入框展示格式，不决定提交给业务的格式。                            |
| `valueFormat`                         | 外部字符串的解析格式，默认 `YYYY-MM-DD HH:mm:ss`。                  |
| `outputFormat`                        | 输出格式；范围可分别指定起止格式。只需要日期时显式传 `YYYY-MM-DD`。 |
| `defaultToday`                        | 默认 true；首次无值时初始化今天。需要空表单时设为 false。           |
| `dateRange`                           | 初次无值时的相对偏移，优先于 defaultToday；不是可选日期边界。       |
| `dateRangeType` / `dateRangeBaseDate` | 偏移单位与基准日期，默认 day / 当前日期。                           |

日期模式默认输出起始日 `00:00:00` 和结束日 `23:59:59`；日期时间模式保留实际时分秒。`change` 和 `update:modelValue` 使用相同输出格式。已有外部值优先于默认初始化；清空后的回填策略应由业务显式决定。

## 可选边界与透传

`disabledDateRange=[min,max]` 优先于 minDate/maxDate。日期时间模式可用 `datetimeDisableTypes` 控制时、分、秒边界。shortcuts=true 使用默认快捷项；数组提供自定义快捷项。业务仍应在提交时校验最终区间。

未声明属性透传到 ElDatePicker，例如 clearable、editable、disabled；当前没有自定义 slot API。禁用整个控件时，应使用外层 tooltip 说明原因。该组件按本地日期语义处理，不执行时区转换。

:::demo 空初始化、日期输出与可选边界分开配置。

```vue
<script setup lang="ts">
import { DateRangePicker } from '@moluoxixi/components'
import { ref } from 'vue'
const range = ref<string[]>([])
</script>
<template>
  <DateRangePicker
    v-model="range"
    type="daterange"
    :default-today="false"
    value-format="YYYY-MM-DD"
    output-format="YYYY-MM-DD"
    :disabled-date-range="['2026-01-01', '2026-12-31']"
  />
  <p>{{ range }}</p>
</template>
```

:::
