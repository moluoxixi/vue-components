<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed } from 'vue'
import { useFormContext } from '@/composables/useFormContext'
import { useBem, useNamespace } from '@/composables/useNamespace'
import { resolveLabelWidth } from '@/utils/style'

/**
 * FormItem 统一管理真实字段的外壳、label、error 和字段根节点 id。
 *
 * 真实字段组件由默认插槽渲染；FormItem 不参与控件绑定属性计算。
 */
defineOptions({ name: 'FormItem' })

const props = withDefaults(defineProps<{
  field: string
  id?: string
  label?: string
  required?: boolean
  showError?: boolean
  span: number
}>(), {
  required: false,
  showError: true,
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

/** 生成 field 根节点类名；字段外壳不再接受任意透传属性。 */
const fieldRootClass = computed(() => [
  b('field'),
  { [m('field', 'inline')]: ctx.inline },
])

/** 字段外壳样式仅由布局语义生成，避免外部属性通道改写根节点。 */
const fieldRootStyle = computed<CSSProperties | undefined>(() => formItemBaseStyle.value)

/** 只读态不展示错误区时，关闭预留高度以保持展示区更紧凑。 */
const controlStyle = computed<CSSProperties | undefined>(() => {
  if (props.showError)
    return undefined

  return { paddingBottom: 0 }
})
</script>

<template>
  <div
    :id="id"
    :class="fieldRootClass"
    :style="fieldRootStyle"
  >
    <label
      v-if="label"
      :class="e('field', 'label')"
      :style="{ width: resolveLabelWidth(ctx.labelWidth) }"
    >
      <span v-if="required" :class="e('field', 'required')">*</span>
      <span>{{ label }}</span>
    </label>

    <div
      :class="e('field', 'control')"
      :style="controlStyle"
    >
      <slot />

      <div
        v-if="showError"
        :class="e('field', 'error')"
        aria-live="polite"
      >
        <span v-for="(msg, i) in error" :key="i">{{ msg }}</span>
      </div>
    </div>
  </div>
</template>
