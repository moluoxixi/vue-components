<script setup lang="ts">
import type { ReadonlyFieldProps } from './types/props'
import FormItem from '@/components/FormItem'
import { useReadonlyField } from './composables/useReadonlyField'

/**
 * ReadonlyField 只负责展示字段值，不参与编辑态事件绑定。
 *
 * 有 label 的字段复用 FormItem 外壳；无 label 的字段保留与 FormComponent 一致的布局壳。
 */
defineOptions({ name: 'ReadonlyField' })

const props = defineProps<ReadonlyFieldProps>()

const {
  componentAttrs,
  formItemComponentProps,
  hasLabel,
  readonlyRenderer,
} = useReadonlyField(props)
</script>

<template>
  <FormItem
    v-if="hasLabel"
    v-bind="formItemComponentProps"
  >
    <component :is="readonlyRenderer" />
  </FormItem>

  <div
    v-else
    v-bind="componentAttrs"
  >
    <component :is="readonlyRenderer" />
  </div>
</template>
