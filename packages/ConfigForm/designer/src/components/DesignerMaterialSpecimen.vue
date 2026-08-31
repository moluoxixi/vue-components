<script setup lang="ts">
import type { RuntimeEditorBridge } from '@moluoxixi/config-form/renderer'
import type { ConfigFormRendererNode } from '@moluoxixi/config-form/renderer'
import type { FormSettings, LayoutNode, NodeSubgraph, PageGraph, SlotItem } from '@moluoxixi/config-form-model'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../registry'
import { RuntimeSurface } from '@moluoxixi/config-form/renderer'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { createDesignPreviewModel } from '../graph'
import { useDesignerLocale } from '../locale'
import { resolveDesignerDesignPolicy } from '../registry'
import { createDesignerMaterialCandidate } from './designer-drag'

const props = defineProps<{
  form?: FormSettings
  material: DesignerMaterialDefinition
  registry: DesignerRegistry
}>()

const hostRef = useTemplateRef<HTMLElement>('host')
const locale = useDesignerLocale()
const visible = ref(true)
const specimenModel = ref<Record<string, unknown>>({})
let observer: IntersectionObserver | undefined

const candidate = computed(() => createDesignerMaterialCandidate(
    props.registry,
    props.material.key,
    `specimen-${props.material.key.replace(/\W+/g, '-')}`,
  ))

function removeSubtrees(
  nodesById: NodeSubgraph['nodesById'],
  items: readonly SlotItem[],
  visited = new Set<string>(),
): void {
  items.forEach(({ nodeId }) => {
    if (visited.has(nodeId))
      return
    visited.add(nodeId)
    const node = nodesById[nodeId]
    if (!node)
      return
    if (node.kind === 'layout')
      Object.values(node.slots).forEach(children => removeSubtrees(nodesById, children, visited))
    delete nodesById[nodeId]
  })
}

function createSpecimenSubgraph(): NodeSubgraph | undefined {
  const value = candidate.value?.subgraph
  if (!value)
    return undefined

  const allowedParent = props.material.allowedParents?.[0]
  if (!allowedParent || props.material.runtime.designerComponent)
    return value

  try {
    const wrapper = structuredClone(props.registry.createSubgraph(allowedParent.material, {
      id: `${value.root[0]?.nodeId ?? 'specimen'}-parent`,
    }))
    const parent = Object.values(wrapper.nodesById).find((node): node is LayoutNode => (
      node.kind === 'layout' && node.component === allowedParent.material
    ))
    if (!parent)
      return undefined

    removeSubtrees(wrapper.nodesById, parent.slots[allowedParent.slot] ?? [])
    const child = structuredClone(value)
    if (Object.keys(child.nodesById).some(nodeId => wrapper.nodesById[nodeId]))
      return undefined

    parent.slots[allowedParent.slot] = child.root
    Object.assign(wrapper.nodesById, child.nodesById)
    return wrapper
  }
  catch {
    return undefined
  }
}

const specimenSubgraph = computed(createSpecimenSubgraph)

const graph = computed<PageGraph | undefined>(() => {
  if (!specimenSubgraph.value)
    return undefined
  return {
    version: 2,
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
    props: {},
    root: specimenSubgraph.value.root,
    nodesById: specimenSubgraph.value.nodesById,
  }
})

function projectNode(subgraph: NodeSubgraph, item: SlotItem): ConfigFormRendererNode | undefined {
  const node = subgraph.nodesById[item.nodeId]
  if (!node)
    return undefined
  const material = props.registry.getMaterial(node.component)
  if (!material || material.kind !== node.kind)
    return undefined
  const policy = resolveDesignerDesignPolicy(material.designPolicy)
  const component = material.runtime.designerComponent
    ?? (policy.render === 'adapter' && policy.adapter
    ? policy.adapter
    : material.runtime.component)
  const common = {
    id: node.id,
    component,
    props: structuredClone(node.props),
    ...(typeof item.placement.span === 'number' ? { span: item.placement.span } : {}),
  }
  if (node.kind === 'layout') {
    return {
      ...common,
      slots: Object.fromEntries(Object.entries(node.slots).map(([slot, items]) => [
        slot,
        items.map(child => projectNode(subgraph, child)).filter((child): child is ConfigFormRendererNode => Boolean(child)),
      ])),
    }
  }
  return {
    ...common,
    field: node.field,
    ...(node.label !== undefined ? { label: node.label } : {}),
    ...(node.defaultValue !== undefined ? { defaultValue: structuredClone(node.defaultValue) } : {}),
    ...(material.runtime.valueProp ? { valueProp: material.runtime.valueProp } : {}),
    ...(material.runtime.trigger ? { trigger: material.runtime.trigger } : {}),
    ...(material.runtime.blurTrigger ? { blurTrigger: material.runtime.blurTrigger } : {}),
    ...(material.runtime.getValueFromEvent ? { getValueFromEvent: material.runtime.getValueFromEvent } : {}),
    ...(material.runtime.readonlyRender
      ? {
          readonlyRender: ({ componentProps, model, value }) => material.runtime.readonlyRender!({
            componentProps,
            model,
            node,
            value,
          }),
        }
      : {}),
  }
}

const projection = computed(() => {
  const value = specimenSubgraph.value
  if (!value)
    return undefined
  return {
    components: props.registry.components,
    fields: value.root.map(item => projectNode(value, item)).filter((node): node is ConfigFormRendererNode => Boolean(node)),
    ...graph.value?.form,
  }
})

const editorBridge: RuntimeEditorBridge<Record<string, unknown>> = {
  getNodeAttrs: metadata => ({
    'aria-hidden': 'true',
    'data-specimen-node-id': metadata.nodeId,
    'tabindex': -1,
  }),
  interceptEvent: () => true,
}

watch(graph, (next) => {
  specimenModel.value = next ? createDesignPreviewModel(next) : {}
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
      {{ material.kind === 'layout' ? locale.t('specimen.layout', 'Layout container') : locale.t('specimen.unavailable', 'Preview unavailable') }}
    </span>
  </div>
</template>
