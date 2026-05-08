<script setup lang="ts" generic="T extends object = Record<string, unknown>">
import { computed, watch } from 'vue'
import type { CSSProperties } from 'vue'
import type { ConfigFormEmits, ConfigFormExpose, ConfigFormProps } from '@/types'
import RecursiveField from '@/components/RecursiveField'
import { useForm } from '@/composables/useForm'
import { provideFormContext } from '@/composables/useFormContext'
import { provideNamespace, useBem } from '@/composables/useNamespace'
import { normalizeFormRuntime } from '@/composables/useRuntime'
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

const rawNodes = computed(() => props.fields)
const initialValues = computed(() => props.modelValue)
const runtimeRef = computed(() => normalizeFormRuntime(props.runtime))
const resolvedNodes = computed(() => runtimeRef.value.transformFields(rawNodes.value))

const {
  values,
  errors,
  visibilityMap,
  disabledMap,
  validate,
  validateSingleField,
  submit,
  reset,
  setValue,
  setValues,
  getValue,
  getValues,
  clearFieldError,
} = useForm({
  fields: resolvedNodes,
  initialValues,
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
  get visibilityMap() { return visibilityMap.value },
  get disabledMap() { return disabledMap.value },
  inline: props.inline,
  labelWidth: resolveLabelWidth(props.labelWidth),
  getValue,
  getValues,
  setValue,
  setValues,
  validateField: (field, trigger) => validateSingleField(field, trigger as 'blur' | 'change' | 'submit'),
})

/**
 * 生成递归节点列表的稳定 key。
 *
 * 字段节点优先使用 field；容器节点没有业务 key 时退回组件名和声明顺序。
 */
function nodeKey(node: typeof resolvedNodes.value[number], index: number): string {
  if ('field' in node)
    return String(node.field)

  return `${String(node.component)}-${index}`
}

const keyedResolvedNodes = computed(() =>
  resolvedNodes.value.map((node, index) => ({
    key: nodeKey(node, index),
    node,
  })),
)

/** 动态生成 form 布局样式，替代 SCSS 硬编码。 */
const formStyle = computed<CSSProperties>(() => {
  if (props.inline) {
    return {
      display: 'flex',
      flexWrap: 'wrap',
      gap: props.gap,
      alignItems: 'center',
    }
  }
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${props.columns}, 1fr)`,
    gap: props.gap,
  }
})

// values 是 reactive 对象，需监听内部字段变化以同步 v-model。
watch(values, (newVals) => {
  emit('update:modelValue', { ...newVals } as T)
}, { deep: true })

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
    <template v-for="item in keyedResolvedNodes" :key="item.key">
      <RecursiveField
        :node="item.node"
      />
    </template>
  </form>
</template>
