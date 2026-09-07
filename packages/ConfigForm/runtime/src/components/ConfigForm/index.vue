<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { ConfigFormRendererEmits, ConfigFormRendererExpose, ConfigFormRendererNode } from '../../renderer'
import type { ConfigFormProps } from './types'
import { computed, useTemplateRef } from 'vue'
import { ConfigFormRenderer, createConfigFormRendererExpose } from '../../renderer'
import { createFormRuntime, projectRuntimeFields } from '../../runtime'

defineOptions({ inheritAttrs: false })
const props = defineProps<ConfigFormProps<TValues>>()
const emit = defineEmits<ConfigFormRendererEmits<TValues>>()
const renderer = useTemplateRef<ConfigFormRendererExpose<TValues>>('renderer')
const runtime = computed(() => createFormRuntime({
  ...props.runtime,
  components: { ...props.runtime?.components, ...props.components },
}))
const fields = computed(() => projectRuntimeFields(
  props.fields,
  runtime.value,
) as ConfigFormRendererNode<TValues>[])
const rendererProps = computed(() => {
  const { runtime: _runtime, fields: _fields, ...rest } = props
  return rest
})
defineExpose(createConfigFormRendererExpose(renderer))
</script>

<template>
  <ConfigFormRenderer
    ref="renderer"
    v-bind="{ ...$attrs, ...rendererProps }"
    :fields="fields"
    @change="emit('change', $event)"
    @error="emit('error', $event)"
    @errors-change="emit('errorsChange', $event)"
    @field-change="emit('fieldChange', $event)"
    @meta-change="emit('metaChange', $event)"
    @runtime-event="emit('runtimeEvent', $event)"
    @submit="emit('submit', $event)"
  >
    <template #default="scope"><slot v-bind="scope" /></template>
  </ConfigFormRenderer>
</template>
