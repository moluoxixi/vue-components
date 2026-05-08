<script setup lang="ts">
import type { ResolvedField, ResolvedFormNode } from '@/types'
import { computed } from 'vue'
import FormNode from '@/components/FormNode'
import { useFormContext } from '@/composables/useFormContext'

/**
 * FormComponent 基于 FormNode 封装，增加值绑定但无 label/error 外包装。
 *
 * props 与 FormField/FormNode 统一为 { field }，
 * 表单状态通过 inject 获取。
 */
defineOptions({ name: 'FormComponent' })

const props = defineProps<{
  field: ResolvedFormNode
}>()

const ctx = useFormContext()

/** 内部断言：FormComponent 只接收 ResolvedField 类型的节点 */
const resolvedField = computed(() => props.field as ResolvedField)

const modelValue = computed(() => ctx.getValue(resolvedField.value.field))
const disabled = computed(() => ctx.disabledMap[resolvedField.value.field])

const componentAttrs = computed(() => ({
  ...resolvedField.value.props,
  disabled: disabled.value || undefined,
  [resolvedField.value.valueProp]: modelValue.value,
}))

const componentListeners = computed<Record<string, (...args: unknown[]) => void>>(() => ({
  [resolvedField.value.blurTrigger]: () => ctx.validateField(resolvedField.value.field, 'blur'),
  [resolvedField.value.trigger]: (...args: unknown[]) => {
    const value = resolvedField.value.getValueFromEvent
      ? resolvedField.value.getValueFromEvent(...args)
      : args[0]
    ctx.setValue(resolvedField.value.field, value)
    ctx.validateField(resolvedField.value.field, 'change')
  },
}))
</script>

<template>
  <FormNode
    :field="field"
    :component-attrs="componentAttrs"
    :component-listeners="componentListeners"
  />
</template>
