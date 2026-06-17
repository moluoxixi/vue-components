<script setup lang="ts">
// 第三方裸模块组件 + v-bind="$attrs" 转发：meta 无法跨包解析其 props，应跳过合并而非抛错。
import { ElDatePicker } from 'some-ui-lib'

interface Props {
  /** 占位文案 */
  placeholder?: string
}
defineProps<Props>()
</script>

<template>
  <ElDatePicker v-bind="$attrs" />
</template>
