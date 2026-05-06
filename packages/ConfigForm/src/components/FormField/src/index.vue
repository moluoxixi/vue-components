<script setup lang="ts">
import type { FormRuntimeResolveSnap } from '@/runtime'
import type { ResolvedField, ResolvedFormNode } from '@/types'
import { computed } from 'vue'
import FormNode from '@/components/FormNode'
import { useFormContext } from '@/composables/useFormContext'
import { useBem, useNamespace } from '@/composables/useNamespace'
import { useRuntime } from '@/composables/useRuntime'
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
 * props 与 FormComponent/FormNode 统一为 { node, resolveSnap }，
 * 表单状态通过 inject 获取，不再依赖外部传入。
 */
defineOptions({ name: 'FormField' })

const props = defineProps<{
  node: ResolvedFormNode
  resolveSnap?: FormRuntimeResolveSnap
}>()

defineSlots<{
  error?: (props: { error?: string[], field: ResolvedField }) => unknown
}>()

const ctx = useFormContext()
const ns = useNamespace()
const { b, e, m } = useBem(ns)
const runtimeRef = useRuntime()

/** 内部断言：FormField 只接收 ResolvedField 类型的节点 */
const field = computed(() => props.node as ResolvedField)

const currentResolveSnap = computed<FormRuntimeResolveSnap>(() => {
  const base = props.resolveSnap ?? runtimeRef.value.createResolveSnap()
  return {
    ...base,
    field: field.value,
  }
})

const modelValue = computed(() => ctx.values[field.value.field])
const error = computed(() => ctx.errors[field.value.field])
const visible = computed(() => ctx.visibilityMap[field.value.field] !== false)
const disabled = computed(() => ctx.disabledMap[field.value.field])

const fieldId = computed(() => {
  const safeFieldName = field.value.field.replace(/[^\w-]/g, '-')
  return `${ns.value}-${safeFieldName}-field`
})

const errorId = computed(() => `${fieldId.value}-error`)

const fieldSourceAttrs = computed<Record<string, string>>(() => {
  const sourceId = (field.value as ResolvedFieldWithDevtoolsSource).__source?.id
  const attrs: Record<string, string> = {}
  if (typeof sourceId === 'string' && sourceId.length > 0)
    attrs[DEVTOOLS_SOURCE_ID_ATTRIBUTE] = sourceId
  return attrs
})

const componentProps = computed(() => {
  const next = { ...(field.value.props ?? {}) }

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
  <div
    v-if="visible"
    v-bind="fieldSourceAttrs"
    :class="[b('field'), { [m('field', 'inline')]: ctx.inline }]"
    :style="!ctx.inline && field.span ? { gridColumn: `span ${field.span}` } : undefined"
  >
    <label
      v-if="field.label"
      :class="e('field', 'label')"
      :for="fieldId"
      :style="{ width: resolveLabelWidth(ctx.labelWidth) }"
    >
      {{ field.label }}
    </label>

    <div :class="e('field', 'control')">
      <FormNode
        :node="node"
        :component-attrs="componentAttrs"
        :component-listeners="componentListeners"
        :resolve-snap="currentResolveSnap"
      />

      <slot name="error" :error="error" :field="field">
        <div v-if="error?.length" :id="errorId" :class="e('field', 'error')">
          <span v-for="(msg, i) in error" :key="i">{{ msg }}</span>
        </div>
      </slot>
    </div>
  </div>
</template>
