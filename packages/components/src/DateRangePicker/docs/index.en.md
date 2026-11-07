# DateRangePicker

A business-oriented wrapper around Element Plus `ElDatePicker` with normalized output, generated initial ranges, and date-boundary controls.

## Basic Usage

:::demo For a single date, `v-model` contains a date string.

```vue
<script setup lang="ts">
import { DateRangePicker } from '@moluoxixi/components'
import { ref } from 'vue'
const date = ref<string>('')
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
const range = ref<string[]>([])
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
const range = ref<string[]>([])
</script>
<template>
  <DateRangePicker v-model="range" type="daterange" :date-range="[-6, 0]" />
</template>
```

:::

## Values, formats and initialization

| Option                                | Contract                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `v-model`                             | Scalar or range input; output is always a string or string array.                                |
| `format`                              | Display format only.                                                                             |
| `valueFormat`                         | Input string parsing format; defaults to `YYYY-MM-DD HH:mm:ss`.                                  |
| `outputFormat`                        | Output format, optionally different for range endpoints. Use `YYYY-MM-DD` for date-only results. |
| `defaultToday`                        | Defaults to true. Set false for an initially empty form.                                         |
| `dateRange`                           | Initial relative offsets, preferred over defaultToday; does not restrict selectable dates.       |
| `dateRangeType` / `dateRangeBaseDate` | Offset unit/base, defaulting to day/current date.                                                |

Date mode defaults to start-of-day `00:00:00` and end-of-day `23:59:59`; datetime mode preserves selected time. `change` and `update:modelValue` use the same output format. Existing values win over initialization; define any business refill policy explicitly.

## Boundaries and forwarding

`disabledDateRange=[min,max]` overrides minDate/maxDate. `datetimeDisableTypes` selects hour/minute/second boundary restrictions. shortcuts=true uses built-in shortcuts; an array supplies custom entries. Validate final ranges again when submitting business data.

Undeclared attributes such as clearable, editable and disabled are forwarded to ElDatePicker. There is no custom slot API. Explain disabled controls with an outer tooltip. Dates use local semantics; this component performs no timezone conversion.

:::demo Configure empty initialization, date-only output and selectable bounds independently.

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
