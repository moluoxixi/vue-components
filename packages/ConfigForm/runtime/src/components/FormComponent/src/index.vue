<script setup lang="ts">
import type { FormComponentProps } from './types/props'
import FormNode from '@/components/FormNode'
import { useFormComponent } from './composables/useFormComponent'

/**
 * FormComponent 基于 FormNode 封装，增加值绑定但无 label/error 外包装。
 *
 * props 与 FormField/FormNode 统一为 { field }，
 * 表单状态通过 inject 获取。
 */
defineOptions({ name: 'FormComponent' })

const props = defineProps<FormComponentProps>()

const { componentAttrs, componentListeners } = useFormComponent(props)
</script>

<template>
  <FormNode
    :field="field"
    :component-attrs="componentAttrs"
    :component-listeners="componentListeners"
  />
</template>
