# DateRangePicker

A business-oriented wrapper around Element Plus `ElDatePicker` with normalized output, generated initial ranges, and date-boundary controls.

## Basic Usage

:::demo For a single date, `v-model` contains a date string.
```vue
<script setup lang="ts">
import { DateRangePicker } from '@moluoxixi/components'
import { ref } from 'vue'
const date = ref('')
</script>
<template>
  <div>
    <DateRangePicker v-model="date" type="date" />
    <p style="margin-top:8px;color:#909399;font-size:13px;">Current value: {{ date || '-' }}</p>
  </div>
</template>
```
:::

## Date Range

:::demo Set `type="daterange"` to bind an array containing the start and end date strings.
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
      {{ range.length ? range.join(' ~ ') : '-' }}
    </p>
  </div>
</template>
```
:::

## Date-Time Range

:::demo Set `type="datetimerange"` for second-level precision and provide `shortcuts` for common ranges.
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
  { text: 'Last 7 days', value: () => [addDays(-6), new Date()] },
  { text: 'Last 30 days', value: () => [addDays(-29), new Date()] },
  { text: 'This month', value: () => [monthBoundary(false), monthBoundary(true)] },
]
</script>
<template>
  <div>
    <DateRangePicker v-model="range" type="datetimerange" :shortcuts="shortcuts" />
    <p style="margin-top:8px;color:#909399;font-size:13px;">
      {{ range.length ? range.join(' ~ ') : '-' }}
    </p>
  </div>
</template>
```
:::

## Initial Offset Range

:::demo Use `dateRange` to set an initial range as day offsets relative to today.
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
