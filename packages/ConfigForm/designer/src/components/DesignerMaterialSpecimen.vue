<script setup lang="ts">
import type { RuntimeEditorBridge } from '@moluoxixi/config-form/renderer'
import type { DesignerDocument, DesignerFormSettings } from '../document'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../registry'
import { RuntimeSurface } from '@moluoxixi/config-form/renderer'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { createDesignerRuntimeProjection } from '../compiler'
import { createDesignerPreviewModel } from '../document'
import { useDesignerLocale } from '../locale'
import { createDesignerMaterialCandidate } from './designer-drag'

const props = defineProps<{
  form?: DesignerFormSettings
  material: DesignerMaterialDefinition
  registry: DesignerRegistry
}>()

const hostRef = useTemplateRef<HTMLElement>('host')
const locale = useDesignerLocale()
const visible = ref(true)
const specimenModel = ref<Record<string, unknown>>({})
let observer: IntersectionObserver | undefined

const document = computed<DesignerDocument | undefined>(() => {
  const node = createDesignerMaterialCandidate(
    props.registry,
    props.material.key,
    `specimen-${props.material.key.replace(/\W+/g, '-')}`,
  )
  if (!node)
    return undefined
  return {
    version: 1,
    form: {
      ...props.form,
      columns: 1,
      fieldSpan: 1,
      gap: '6px',
      inline: false,
      labelPosition: 'top',
      readonly: false,
      responsive: undefined,
    },
    nodes: [node],
  }
})

const projection = computed(() => document.value
  ? createDesignerRuntimeProjection(document.value, props.registry)
  : undefined)

const editorBridge: RuntimeEditorBridge<Record<string, unknown>> = {
  getNodeAttrs: metadata => ({
    'aria-hidden': 'true',
    'data-specimen-node-id': metadata.nodeId,
    'tabindex': -1,
  }),
  interceptEvent: () => true,
}

watch(document, (next) => {
  specimenModel.value = next ? createDesignerPreviewModel(next) : {}
}, { immediate: true })

onMounted(() => {
  const host = hostRef.value
  if (!host || typeof IntersectionObserver === 'undefined') {
    visible.value = true
    return
  }
  observer = new IntersectionObserver((entries) => {
    visible.value = entries.some(entry => entry.isIntersecting)
  }, { rootMargin: '120px 0px' })
  observer.observe(host)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="host" class="mx-config-form-designer__palette-item-preview" aria-hidden="true" inert>
    <RuntimeSurface
      v-if="visible && projection && projection.fields.length > 0"
      v-model="specimenModel"
      :columns="projection.columns"
      :components="projection.components"
      :editor="editorBridge"
      :field-span="projection.fieldSpan"
      :fields="projection.fields"
      :gap="projection.gap"
      :inline="projection.inline"
      :label-position="projection.labelPosition"
      :namespace="registry.rendererNamespace"
      :responsive="projection.responsive"
      mode="design"
    />
    <span v-else-if="visible" class="mx-config-form-designer__palette-preview-unavailable">
      {{ material.kind === 'container' ? locale.t('specimen.layout', 'Layout container') : locale.t('specimen.unavailable', 'Preview unavailable') }}
    </span>
  </div>
</template>
