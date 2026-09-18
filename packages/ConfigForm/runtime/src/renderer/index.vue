<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type {
  ConfigFormRendererEmits,
  ConfigFormRendererExpose,
  ConfigFormRendererProps,
} from './types'
import type { RendererControllerState } from './types/internal'
import { computed, defineComponent, useAttrs, useId, useTemplateRef } from 'vue'
import {
  useDesignInteractionGuard,
  useRendererController,
  useRendererDataLifecycle,
  useRendererLayout,
  useRuntimeEditorBridge,
} from './composables'
import { createRendererBindingService } from './services/binding'
import { createComponentListenerService } from './services/component-listeners'
import { createBem } from './services/rendering'
import { createRendererPipeline } from './services/renderer-pipeline'

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
const attrs = useAttrs()
const formRef = useTemplateRef<HTMLFormElement>('formRef')
const formId = useId()

let controller: RendererControllerState<TValues>
const dataLifecycle = useRendererDataLifecycle({ props, emit, controller: () => controller })
controller = useRendererController({
  emit,
  props,
  onScopeInvalidated: dataLifecycle.cancelScope,
  onLifecycle: dataLifecycle.lifecycle,
  shouldRunLifecycle: dataLifecycle.hasLifecycle,
})
const { meta, model, resetFields, submit } = controller
const editorBridge = useRuntimeEditorBridge({ props })
const designGuard = useDesignInteractionGuard({
  formRef,
  mode: () => props.mode,
})
const componentListeners = createComponentListenerService({
  mode: () => props.mode,
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
  cancelScope: dataLifecycle.cancelScope,
  componentListeners,
  controller,
  designGuard,
  editorBridge,
  formId,
  getOptionState: dataLifecycle.data.getOptionState,
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
  appendRow: controller.appendRow,
  applyFieldInstanceChange: controller.applyFieldInstanceChange,
  clearInstanceValidate: controller.clearInstanceValidate,
  clearValidate: controller.clearValidate,
  duplicateRow: controller.duplicateRow,
  getDataSourceState: dataLifecycle.data.getDataSourceState,
  getErrors: controller.getErrors,
  getFieldMeta: controller.getFieldMeta,
  getInstanceErrors: controller.getInstanceErrors,
  getInstanceKey: controller.getInstanceKey,
  getInstanceMeta: controller.getInstanceMeta,
  getInstanceValue: controller.getInstanceValue,
  getIssues: controller.getIssues,
  getMeta: controller.getMeta,
  getOptionState: dataLifecycle.data.getOptionState,
  getValidating: controller.getValidating,
  getValue: controller.getValue,
  getValues: controller.getValues,
  getVariables: dataLifecycle.data.getVariables,
  insertRow: controller.insertRow,
  isInstanceValidating: controller.isInstanceValidating,
  listFieldInstances: controller.listFieldInstances,
  listRows: controller.listRows,
  loadDataSource: (sourceId, options) => dataLifecycle.data.loadDataSource(sourceId, options),
  moveRow: controller.moveRow,
  removeRow: controller.removeRow,
  resetFields: controller.resetFields,
  scrollToField,
  setErrors: controller.setErrors,
  setInstanceTouched: controller.setInstanceTouched,
  setInstanceValue: controller.setInstanceValue,
  setTouched: controller.setTouched,
  setValue: controller.setValue,
  setValues: controller.setValues,
  submit: controller.submit,
  validate: controller.validate,
  validateField: controller.validateField,
  validateInstance: controller.validateInstance,
})
</script>

<template>
  <form
    ref="formRef"
    v-bind="formAttrs"
    data-config-form-responsive-root
    :data-config-form-mode="mode"
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
