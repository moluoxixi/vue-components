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
  useRendererEvents,
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
const attrs = useAttrs()
const formRef = useTemplateRef<HTMLFormElement>('formRef')
const formId = useId()

let controller: RendererControllerState<TValues>
const events = useRendererEvents({ props, emit, controller: () => controller })
controller = useRendererController({
  emit,
  props,
  onDiagnostic: events.controllerDiagnostic,
  onScopeInvalidated: events.cancelScope,
  onLifecycle: events.lifecycle,
  reactionProjection: events.projection,
  shouldRunLifecycle: events.hasLifecycle,
})
const { meta, model, resetFields, submit } = controller
const editorBridge = useRuntimeEditorBridge({ props })
const designGuard = useDesignInteractionGuard({
  formRef,
  mode: () => props.mode,
})
const flowEvents = createRuntimeFlowEventService({
  emitRuntimeEvent: events.componentEvent,
  eventNames: events.eventNames,
  onError: diagnostic => emit('flowError', diagnostic),
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
  cancelScope: events.cancelScope,
  controller,
  designGuard,
  editorBridge,
  flowEvents,
  formId,
  getOptionState: events.data.getOptionState,
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
  getDataSourceState: events.data.getDataSourceState,
  getErrors: controller.getErrors,
  getFieldMeta: controller.getFieldMeta,
  getInstanceErrors: controller.getInstanceErrors,
  getInstanceKey: controller.getInstanceKey,
  getInstanceMeta: controller.getInstanceMeta,
  getInstanceValue: controller.getInstanceValue,
  getIssues: controller.getIssues,
  getMeta: controller.getMeta,
  getOptionState: events.data.getOptionState,
  getValidating: controller.getValidating,
  getValue: controller.getValue,
  getValues: controller.getValues,
  getVariables: events.data.getVariables,
  insertRow: controller.insertRow,
  isInstanceValidating: controller.isInstanceValidating,
  listFieldInstances: controller.listFieldInstances,
  listRows: controller.listRows,
  loadDataSource: (sourceId, options) => events.data.loadDataSource(sourceId, options),
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
