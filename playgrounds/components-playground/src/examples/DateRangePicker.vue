<script lang="ts">
// 示例元信息由 playground 通过 import.meta.glob 读取，用于生成侧栏和页面标题。
export const exampleMeta = {
  name: 'DateRangePicker',
  title: 'DateRangePicker',
  category: '表单输入',
  description: '统一日期选择器的范围、时间范围和输出格式场景。',
  order: 10,
}
</script>

<script setup lang="ts">
import { DateRangePicker } from '@moluoxixi/components'
import { reactive, shallowRef } from 'vue'

const dateValues = reactive({
  dayRange: [] as string[],
  timeRange: [] as string[],
  singleDate: '',
})

const lastChanged = shallowRef('等待选择')

function handleChange(value: string | string[]): void {
  lastChanged.value = Array.isArray(value) ? value.join(' 至 ') : value
}
</script>

<template>
  <div class="date-range-example">
    <ElForm label-width="120px">
      <ElFormItem label="日期范围">
        <DateRangePicker
          v-model="dateValues.dayRange"
          type="daterange"
          :shortcuts="true"
          :date-range="[-6, 0]"
          @change="handleChange"
        />
      </ElFormItem>

      <ElFormItem label="日期时间范围">
        <DateRangePicker
          v-model="dateValues.timeRange"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          :disabled-date-range="['2026-01-01 08:00:00', '2026-12-31 20:00:00']"
          @change="handleChange"
        />
      </ElFormItem>

      <ElFormItem label="单日期">
        <DateRangePicker
          v-model="dateValues.singleDate"
          type="date"
          output-format="YYYY/MM/DD"
          placeholder="选择业务日期"
          @change="handleChange"
        />
      </ElFormItem>
    </ElForm>

    <ElDivider />

    <ElDescriptions :column="1" border>
      <ElDescriptionsItem label="日期范围">
        {{ dateValues.dayRange }}
      </ElDescriptionsItem>
      <ElDescriptionsItem label="日期时间范围">
        {{ dateValues.timeRange }}
      </ElDescriptionsItem>
      <ElDescriptionsItem label="单日期">
        {{ dateValues.singleDate }}
      </ElDescriptionsItem>
      <ElDescriptionsItem label="最后变更">
        {{ lastChanged }}
      </ElDescriptionsItem>
    </ElDescriptions>
  </div>
</template>

<style scoped lang="scss">
.date-range-example {
  max-width: 760px;
}
</style>
