<script setup lang="ts">
import type { ResolvedField, ResolvedFormNode } from '@/types'
import { computed } from 'vue'
import FormNode from '@/components/FormNode'
import { useFormContext } from '@/composables/useFormContext'
import { useBem, useNamespace } from '@/composables/useNamespace'
import { resolveLabelWidth } from '@/utils/style'

interface InternalFieldSourceMeta {
  readonly id?: unknown
}

type ResolvedFieldWithDevtoolsSource = ResolvedField & {
  readonly __source?: InternalFieldSourceMeta
}

const DEVTOOLS_SOURCE_ID_ATTRIBUTE = 'data-cf-devtools-source-id'

/**
 * FormField 基于 FormNode 封装，增加 label + error + 值绑定。
 *
 * props 与 FormComponent/FormNode 统一为 { field }，
 * 表单状态通过 inject 获取，不再依赖外部传入。
 */
defineOptions({ name: 'FormField' })

const props = defineProps<{
  field: ResolvedFormNode
}>()

defineSlots<{
  error?: (props: { error?: string[], field: ResolvedField }) => unknown
}>()

const ctx = useFormContext()
const ns = useNamespace()
const { b, e, m } = useBem(ns)

/** 内部断言：FormField 只接收 ResolvedField 类型的节点 */
const resolvedField = computed(() => props.field as ResolvedField)

const modelValue = computed(() => ctx.getValue(resolvedField.value.field))
const error = computed(() => ctx.errors[resolvedField.value.field])
const visible = computed(() => ctx.visibilityMap[resolvedField.value.field] !== false)
const disabled = computed(() => ctx.disabledMap[resolvedField.value.field])

const fieldId = computed(() => {
  const safeFieldName = resolvedField.value.field.replace(/[^\w-]/g, '-')
  return `${ns.value}-${safeFieldName}-field`
})

const errorId = computed(() => `${fieldId.value}-error`)

const fieldSourceAttrs = computed<Record<string, string>>(() => {
  const sourceId = (resolvedField.value as ResolvedFieldWithDevtoolsSource).__source?.id
  const attrs: Record<string, string> = {}
  if (typeof sourceId === 'string' && sourceId.length > 0)
    attrs[DEVTOOLS_SOURCE_ID_ATTRIBUTE] = sourceId
  return attrs
})

const componentProps = computed(() => {
  const next = { ...(resolvedField.value.props ?? {}) }

  if (next.id == null)
    next.id = fieldId.value

  if (error.value?.length) {
    next['aria-invalid'] = true
    next['aria-describedby'] = errorId.value
  }

  if (disabled.value)
    next.disabled = true

  return next
})

const componentAttrs = computed(() => ({
  ...componentProps.value,
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
  <div
    v-if="visible"
    v-bind="fieldSourceAttrs"
    :class="[b('field'), { [m('field', 'inline')]: ctx.inline }]"
    :style="!ctx.inline && resolvedField.span ? { gridColumn: `span ${resolvedField.span}` } : undefined"
  >
    <label
      v-if="resolvedField.label"
      :class="e('field', 'label')"
      :for="fieldId"
      :style="{ width: resolveLabelWidth(ctx.labelWidth) }"
    >
      {{ resolvedField.label }}
    </label>

    <div :class="e('field', 'control')">
      <FormNode
        :field="field"
        :component-attrs="componentAttrs"
        :component-listeners="componentListeners"
      />

      <slot name="error" :error="error" :field="resolvedField">
        <div v-if="error?.length" :id="errorId" :class="e('field', 'error')">
          <span v-for="(msg, i) in error" :key="i">{{ msg }}</span>
        </div>
      </slot>
    </div>
  </div>
</template>
