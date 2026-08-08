<script setup lang="ts">
import type { DesignerFormSettings, DesignerNode } from '../document'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../registry'
import { computed } from 'vue'

const props = defineProps<{
  node: DesignerNode
  registry: DesignerRegistry
  labelPosition?: DesignerFormSettings['labelPosition']
  readonly?: boolean
}>()

const material = computed<DesignerMaterialDefinition | undefined>(() => (
  props.registry.getMaterial(props.node.material)
))

const materialSlots = computed(() => (
  material.value?.kind === 'container' ? material.value.slots : []
))

function eventPropName(eventName: string): string {
  return `on${eventName.slice(0, 1).toUpperCase()}${eventName.slice(1)}`
}

const componentProps = computed<Record<string, unknown>>(() => {
  const definition = material.value
  if (!definition)
    return {}

  const nextProps: Record<string, unknown> = { ...(props.node.props ?? {}) }
  if (props.node.kind !== 'field')
    return nextProps

  const valueProp = definition.runtime.valueProp ?? 'modelValue'
  if (!Object.hasOwn(nextProps, valueProp) && props.node.defaultValue !== undefined)
    nextProps[valueProp] = props.node.defaultValue

  const trigger = definition.runtime.trigger ?? `update:${valueProp}`
  nextProps[eventPropName(trigger)] = () => undefined
  if (definition.runtime.blurTrigger)
    nextProps[eventPropName(definition.runtime.blurTrigger)] = () => undefined
  if (props.readonly)
    nextProps[definition.runtime.readonlyProp ?? 'readonly'] = true
  return nextProps
})
</script>

<template>
  <div
    class="mx-config-form-designer__node-preview"
    :class="{
      'is-field': node.kind === 'field',
      'is-container': node.kind === 'container',
      'is-unsupported': !material,
      'is-readonly': readonly,
      'has-label': node.kind === 'field' && Boolean(node.label),
      'is-label-left': node.kind === 'field' && labelPosition !== 'top',
      'is-label-top': node.kind === 'field' && labelPosition === 'top',
    }"
  >
    <template v-if="material">
      <div v-if="node.kind === 'field' && node.label" class="mx-config-form-designer__node-preview-label">
        {{ node.label }}
      </div>
      <div
        class="mx-config-form-designer__node-preview-real"
        :class="{ 'is-field': node.kind === 'field' }"
      >
        <div v-if="node.kind === 'field'" class="mx-config-form-designer__node-preview-control" inert aria-hidden="true">
          <component :is="material.runtime.component" v-bind="componentProps" />
        </div>
        <component v-else :is="material.runtime.component" v-bind="componentProps">
          <template v-for="slot in materialSlots" :key="slot.name" #[slot.name]>
            <slot :name="slot.name" />
          </template>
        </component>
      </div>
    </template>
  </div>
</template>
