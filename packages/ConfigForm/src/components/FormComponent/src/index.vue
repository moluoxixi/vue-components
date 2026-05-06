<script setup lang="ts">
import type { FormRuntimeResolveSnap } from '@/runtime'
import type { ResolvedField, ResolvedFormNode } from '@/types'
import { computed } from 'vue'
import FormNode from '@/components/FormNode'
import { useFormContext } from '@/composables/useFormContext'

/**
 * FormComponent 基于 FormNode 封装，增加值绑定但无 label/error 外包装。
 *
 * props 与 FormField/FormNode 统一为 { node, resolveSnap }，
 * 表单状态通过 inject 获取。
 */
defineOptions({ name: 'FormComponent' })

const props = defineProps<{
  node: ResolvedFormNode
  resolveSnap?: FormRuntimeResolveSnap
}>()

const ctx = useFormContext()

/** 内部断言：FormComponent 只接收 ResolvedField 类型的节点 */
const field = computed(() => props.node as ResolvedField)

const modelValue = computed(() => ctx.values[field.value.field])
const disabled = computed(() => ctx.disabledMap[field.value.field])

const componentAttrs = computed(() => ({
  ...field.value.props,
  disabled: disabled.value || undefined,
  [field.value.valueProp]: modelValue.value,
}))

const componentListeners = computed<Record<string, (...args: unknown[]) => void>>(() => ({
  [field.value.blurTrigger]: () => ctx.validateField(field.value.field, 'blur'),
  [field.value.trigger]: (...args: unknown[]) => {
    const value = field.value.getValueFromEvent
      ? field.value.getValueFromEvent(...args)
      : args[0]
    ctx.setValue(field.value.field, value)
    ctx.validateField(field.value.field, 'change')
  },
}))
</script>

<template>
  <FormNode
    :node="node"
    :component-attrs="componentAttrs"
    :component-listeners="componentListeners"
    :resolve-snap="resolveSnap"
  />
</template>
