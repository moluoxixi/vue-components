<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type {
  ConfigFormRendererEmits,
  ConfigFormRendererExpose,
  ConfigFormRendererProps,
} from './types'
import { computed, defineComponent, useAttrs, useId, useTemplateRef } from 'vue'
import {
  useDesignInteractionGuard,
  useRendererController,
  useRendererLayout,
  useRuntimeEditorBridge,
} from './composables'
import { createRendererBindingService } from './services/binding'
import { createBem } from './services/rendering'
import { createRendererPipeline } from './services/renderer-pipeline'
import { createRuntimeFlowEventService } from './services/runtime-flow-events'

defineOptions({
  name: 'ConfigFormRenderer',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<ConfigFormRendererProps<TValues>>(), {
  cellAttrs: () => ({}),
  columns: 24,
  defaultTrigger: 'update:modelValue',
  defaultValueProp: 'modelValue',
  fieldSpan: 24,
  formAttrs: () => ({}),
  gap: '16px',
  labelPosition: 'left',
  mode: 'preview',
  namespace: 'mx-config-form',
  layoutAttrs: () => ({}),
})

const emit = defineEmits<ConfigFormRendererEmits<TValues>>()
const controlledModel = defineModel<TValues>({ required: true })
const attrs = useAttrs()
const formRef = useTemplateRef<HTMLFormElement>('formRef')
const formId = useId()

const controller = useRendererController({ controlledModel, emit, props })
const { meta, model, resetFields, submit } = controller
const editorBridge = useRuntimeEditorBridge({ props })
const designGuard = useDesignInteractionGuard({
  formRef,
  mode: () => props.mode,
})
const flowEvents = createRuntimeFlowEventService({
  emitRuntimeEvent: payload => emit('runtimeEvent', payload),
  mode: () => props.mode,
  shouldIntercept: editorBridge.shouldInterceptEditorEvent,
})
const binding = createRendererBindingService(props)
const {
  activePresentationLayout,
  responsiveLabelWidths,
  responsiveLayouts,
} = useRendererLayout(props)
const bem = createBem(() => props.namespace)
const renderLayout = createRendererPipeline({
  activePresentationLayout,
  bem,
  binding,
  controller,
  designGuard,
  editorBridge,
  flowEvents,
  formId,
  props,
  responsiveLabelWidths,
  responsiveLayouts,
})

const formAttrs = computed<Record<string, unknown>>(() => ({
  ...attrs,
  ...props.formAttrs,
  class: [props.namespace, attrs.class, props.formAttrs.class],
}))
const ConfigFormTree = defineComponent({
  name: 'ConfigFormRendererTree',
  setup: () => renderLayout,
})

function scrollToField(field: keyof TValues & string | string): void {
  const target = Array.from(formRef.value?.querySelectorAll<HTMLElement>('[data-field]') ?? [])
    .find(element => element.dataset.field === field)
  target?.scrollIntoView()
}

defineExpose<ConfigFormRendererExpose<TValues>>({
  clearValidate: controller.clearValidate,
  getFieldMeta: controller.getFieldMeta,
  getErrors: controller.getErrors,
  getMeta: controller.getMeta,
  getValidating: controller.getValidating,
  getValue: controller.getValue,
  getValues: controller.getValues,
  resetFields: controller.resetFields,
  scrollToField,
  setErrors: controller.setErrors,
  setValue: controller.setValue,
  setValues: controller.setValues,
  setTouched: controller.setTouched,
  submit: controller.submit,
  validate: controller.validate,
  validateField: controller.validateField,
})
</script>

<template>
  <form
    ref="formRef"
    v-bind="formAttrs"
    data-config-form-responsive-root
    :data-dirty="meta.dirty"
    :data-touched="meta.touched"
    @submit.prevent="submit"
  >
    <ConfigFormTree />

    <slot
      v-bind="{
        meta,
        model,
        submit,
        resetFields,
      }"
    />
  </form>
</template>

<style lang="scss">
@use '../styles/responsive';
</style>
