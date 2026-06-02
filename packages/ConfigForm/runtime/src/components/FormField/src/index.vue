<script setup lang="ts">
import type { FormFieldProps } from './types/props'
import FormComponent from '@/components/FormComponent'
import FormItem from '@/components/FormItem'
import { useFormField } from './composables/useFormField'

/**
 * FormField 组合 FormItem 与 FormComponent，保留带 label 字段的公共入口。
 *
 * 外壳、label 和 error 由 FormItem 处理；值绑定和组件渲染由 FormComponent 独立处理。
 */
defineOptions({ name: 'FormField' })

const props = defineProps<FormFieldProps>()

const { formItemComponentProps } = useFormField(props)
</script>

<template>
  <FormItem
    v-bind="formItemComponentProps"
  >
    <FormComponent :field="field" />
  </FormItem>
</template>
