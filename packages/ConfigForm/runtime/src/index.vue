<script setup lang="ts" generic="T extends object = Record<string, unknown>">
import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import type { ConfigFormEmits, ConfigFormExpose, ConfigFormProps } from '@/types'
import RecursiveField from '@/components/RecursiveField'
import { useForm } from '@/composables/useForm'
import { provideFormContext } from '@/composables/useFormContext'
import { provideNamespace, useBem } from '@/composables/useNamespace'
import { normalizeFormRuntime, provideRuntime } from '@/composables/useRuntime'
import { getResolvedNodeRenderKey } from '@/utils/slot'
import { resolveLabelWidth } from '@/utils/style'

/**
 * ConfigForm 根组件负责注入命名空间和 runtime，并把声明式节点树连接到无头表单控制器。
 */
const props = withDefaults(defineProps<ConfigFormProps<T>>(), {
  namespace: 'cf',
  columns: 24,
  gap: '8px 8px',
})

const emit = defineEmits<ConfigFormEmits<T>>()

const namespaceRef = computed(() => props.namespace)
provideNamespace(namespaceRef)
const { b } = useBem(namespaceRef)

const rawFields = computed(() => props.fields)
const defaultValues = computed(() => props.defaultValues)
const runtimeRef = computed(() => normalizeFormRuntime(props.runtime))
provideRuntime(runtimeRef)
const resolvedFields = computed(() => rawFields.value.map(field => runtimeRef.value.transformField(field)))

const {
  values,
  errors,
  validate,
  validateSingleField,
  submit,
  reset,
  setValue,
  setValues,
  getValue,
  getValues,
  isVisible,
  isDisabled,
  isReadonly,
  clearFieldError,
} = useForm({
  fields: resolvedFields,
  defaultValues,
  /**
   * 将无头控制器的提交结果转为组件 submit 事件。
   *
   * 事件值已经经过字段 transform，组件层不再二次处理。
   */
  onSubmit: vals => emit('submit', vals as T),
  /**
   * 将无头控制器的校验失败结果转为组件 error 事件。
   *
   * 错误对象保持字段维度结构，供调用方或 slot 自行展示。
   */
  onError: errs => emit('error', errs),
})

provideFormContext({
  get values() { return values },
  get errors() { return errors.value },
  get inline() { return props.inline },
  get labelWidth() { return resolveLabelWidth(props.labelWidth) },
  getValue,
  getValues,
  isVisible,
  isDisabled,
  isReadonly,
  setValue,
  setValues: (nextValues, replace) => setValues(nextValues as Partial<T>, replace),
  validateField: validateSingleField,
})

const keyedResolvedFields = computed(() =>
  resolvedFields.value.map((field, index) => ({
    field,
    key: getResolvedNodeRenderKey(field, `fields.${index}`),
  })),
)

/** 动态生成 form 布局样式，替代 SCSS 硬编码。 */
const formStyle = computed<CSSProperties>(() => {
  if (props.inline) {
    return {
      display: 'flex',
      flexWrap: 'wrap',
      gap: props.gap,
      alignItems: 'flex-start',
    }
  }
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${props.columns}, 1fr)`,
    gap: props.gap,
  }
})

defineExpose<ConfigFormExpose<T>>({
  submit,
  validate,
  /**
   * 暴露单字段校验入口。
   *
   * 默认按 submit 语义校验，调用方可显式传入 blur/change 复用字段触发规则。
   */
  validateField: (field, trigger = 'submit') => validateSingleField(field, trigger),
  reset,
  setValue,
  setValues,
  getValue,
  getValues: getValues as () => T,
  clearValidate: clearFieldError,
})
</script>

<template>
  <form
    :class="b('form')"
    :style="formStyle"
    @submit.prevent="submit()"
  >
    <template v-for="item in keyedResolvedFields" :key="item.key">
      <RecursiveField
        :field="item.field"
      />
    </template>
  </form>
</template>
