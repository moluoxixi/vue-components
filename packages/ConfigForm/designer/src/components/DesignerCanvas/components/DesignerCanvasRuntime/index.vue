<script setup lang="ts">
import type { ConfigFormBreakpoint, ConfigFormRuntimeEditorBridge } from '@moluoxixi/config-form'
import type { VueRuntimeRendererConfig } from '@moluoxixi/config-form-vue-backend'
import { ConfigFormRenderer } from '@moluoxixi/config-form'

defineProps<{
  breakpoint?: ConfigFormBreakpoint
  editor: ConfigFormRuntimeEditorBridge<Record<string, unknown>>
  interactive: boolean
  modelValue: Record<string, unknown>
  namespace?: string
  renderer: VueRuntimeRendererConfig
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
}>()
</script>

<template>
  <ConfigFormRenderer
    :model-value="modelValue"
    :fields="renderer.fields"
    :components="renderer.components"
    :namespace="namespace"
    :readonly="renderer.readonly"
    :inline="renderer.inline"
    :columns="renderer.columns"
    :gap="renderer.gap"
    :field-span="renderer.fieldSpan"
    :label-position="renderer.labelPosition"
    :responsive="renderer.responsive"
    :breakpoint="breakpoint"
    :editor="editor"
    :aria-hidden="!interactive ? 'true' : undefined"
    :inert="!interactive ? true : undefined"
    mode="design"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
