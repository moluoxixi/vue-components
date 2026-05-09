<script setup lang="ts">
import type { ResolvedField } from '@/types'
import { computed } from 'vue'
import RecursiveField from '@/components/RecursiveField'
import { useFieldBinding } from '@/composables/useFieldBinding'
import { useFormContext } from '@/composables/useFormContext'
import { useBem, useNamespace } from '@/composables/useNamespace'
import { resolveSlotNodes } from '@/utils/slot'
import { mergeStyle, readStyleValue, resolveLabelWidth } from '@/utils/style'

/**
 * FormField 负责真实字段的 label、error、值绑定和字段组件渲染。
 *
 * props 使用 { field }，表单状态通过 inject 获取，不再复用 FormNode 的容器可见性逻辑。
 */
defineOptions({ name: 'FormField' })

const props = defineProps<{
  field: ResolvedField
}>()

defineSlots<{
  error?: (props: { error?: string[], field: ResolvedField }) => unknown
}>()

const ctx = useFormContext()
const ns = useNamespace()
const { b, e, m } = useBem(ns)

/** 当前真实字段配置；RecursiveField 只会把 ResolvedField 分派到本组件。 */
const resolvedField = computed(() => props.field)

const error = computed(() => ctx.errors[resolvedField.value.field])
const visible = computed(() => ctx.isVisible(resolvedField.value))

const fieldId = computed(() => {
  const safeFieldName = resolvedField.value.field.replace(/[^\w-]/g, '-')
  return `${ns.value}-${safeFieldName}-field`
})

const errorId = computed(() => `${fieldId.value}-error`)

const fieldRootStyle = computed(() => {
  const baseStyle = ctx.inline
    ? undefined
    : { gridColumn: `span ${resolvedField.value.span}` }
  const existingStyle = readStyleValue(resolvedField.value.rootProps.style, 'rootProps.style')
  return mergeStyle(baseStyle, existingStyle)
})

const fieldRootClass = computed(() => [
  b('field'),
  { [m('field', 'inline')]: ctx.inline },
  resolvedField.value.rootProps.class,
])

const fieldRootAttrs = computed<Record<string, unknown>>(() => {
  const attrs: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(resolvedField.value.rootProps)) {
    if (key === 'class' || key === 'style')
      continue
    attrs[key] = value
  }

  if (fieldRootStyle.value)
    attrs.style = fieldRootStyle.value

  return attrs
})

const fieldAttrs = computed<Record<string, unknown>>(() => {
  const next: Record<string, unknown> = {}

  if (resolvedField.value.props.id == null)
    next.id = fieldId.value

  if (error.value?.length) {
    next['aria-invalid'] = true
    next['aria-describedby'] = errorId.value
  }

  return next
})

const { attrs: componentAttrs, listeners: componentListeners } = useFieldBinding(resolvedField, fieldAttrs)
</script>

<template>
  <div
    v-if="visible"
    v-bind="fieldRootAttrs"
    :class="fieldRootClass"
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
      <component
        :is="resolvedField.component"
        v-bind="componentAttrs"
        v-on="componentListeners"
      >
        <template v-for="(slotValue, slotName) in resolvedField.slots" :key="slotName" #[slotName]>
          <template
            v-for="slotField in resolveSlotNodes(slotValue, String(slotName))"
            :key="slotField.key"
          >
            <RecursiveField
              :field="slotField.field"
            />
          </template>
        </template>
      </component>

      <slot name="error" :error="error" :field="resolvedField">
        <div v-if="error?.length" :id="errorId" :class="e('field', 'error')">
          <span v-for="(msg, i) in error" :key="i">{{ msg }}</span>
        </div>
      </slot>
    </div>
  </div>
</template>
