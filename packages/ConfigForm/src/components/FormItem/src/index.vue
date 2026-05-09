<script setup lang="ts">
import type { CSSProperties, StyleValue } from 'vue'
import { computed } from 'vue'
import { useFormContext } from '@/composables/useFormContext'
import { useBem, useNamespace } from '@/composables/useNamespace'
import { mergeStyle, readStyleValue, resolveLabelWidth } from '@/utils/style'

/**
 * FormItem 统一管理真实字段的外壳、label、error 和根节点透传属性。
 *
 * 真实字段组件由默认插槽渲染；FormItem 不参与控件绑定属性计算。
 */
defineOptions({ name: 'FormItem' })

const props = withDefaults(defineProps<{
  field: string
  formItemProps?: Record<string, unknown>
  label?: string
  span: number
}>(), {
  formItemProps: () => ({}),
})

defineSlots<{
  default?: () => unknown
}>()

const ctx = useFormContext()
const ns = useNamespace()
const { b, e, m } = useBem(ns)

/** 当前字段的校验错误；错误集合由表单控制器统一维护。 */
const error = computed(() => ctx.errors[props.field])

/** grid 模式下的字段外壳跨度；inline 模式不写入布局样式。 */
const formItemBaseStyle = computed<CSSProperties | undefined>(() => {
  if (ctx.inline)
    return undefined

  return { gridColumn: `span ${props.span}` }
})

/** 根节点透传属性去掉 class/style，避免覆盖内置外壳合并策略。 */
const formItemRootAttrs = computed(() => {
  const { class: _class, style: _style, ...attrs } = props.formItemProps
  return attrs
})

/** 生成 field 根节点类名，并合并用户传给 FormItem 根节点的 class。 */
const fieldRootClass = computed(() => [
  b('field'),
  { [m('field', 'inline')]: ctx.inline },
  props.formItemProps.class,
])

/** 合并字段布局样式和用户传给 FormItem 根节点的 Vue style 值。 */
const fieldRootStyle = computed<StyleValue | undefined>(() =>
  mergeStyle(formItemBaseStyle.value, readStyleValue(props.formItemProps.style, 'formItemProps.style')),
)
</script>

<template>
  <div
    v-bind="formItemRootAttrs"
    :class="fieldRootClass"
    :style="fieldRootStyle"
  >
    <label
      v-if="label"
      :class="e('field', 'label')"
      :style="{ width: resolveLabelWidth(ctx.labelWidth) }"
    >
      {{ label }}
    </label>

    <div :class="e('field', 'control')">
      <slot />

      <div v-if="error?.length" :class="e('field', 'error')">
        <span v-for="(msg, i) in error" :key="i">{{ msg }}</span>
      </div>
    </div>
  </div>
</template>
