<script setup lang="ts">
import type { DesignerFormSettings, DesignerNode } from '../document'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../registry'
import type { PropType, VNodeChild } from 'vue'
import { computed, defineComponent } from 'vue'
import { formatConfigFormReadonlyValue } from '@moluoxixi/config-form-headless'
import { evaluateDesignerCondition } from '../condition'

const DesignerReadonlyContent = defineComponent({
  name: 'DesignerReadonlyContent',
  props: {
    content: {
      type: null as unknown as PropType<VNodeChild>,
      required: true,
    },
  },
  setup: props => () => props.content,
})

const props = defineProps<{
  node: DesignerNode
  registry: DesignerRegistry
  labelPosition?: DesignerFormSettings['labelPosition']
  readonly?: boolean
  interactive?: boolean
  model?: Record<string, unknown>
}>()

const emit = defineEmits<{
  updateField: [field: string, value: unknown]
}>()

const material = computed<DesignerMaterialDefinition | undefined>(() => (
  props.registry.getMaterial(props.node.material)
))

const materialSlots = computed(() => (
  material.value?.kind === 'container' ? material.value.slots : []
))

function condition(target: 'required' | 'disabled' | 'readonly', fallback = false): boolean {
  const expression = props.node.conditions?.[target]
  return props.interactive && expression
    ? evaluateDesignerCondition(expression, props.model ?? {})
    : fallback
}

const required = computed(() => props.node.kind === 'field' && condition('required'))
const disabled = computed(() => props.node.kind === 'field' && condition('disabled'))
const fieldReadonly = computed(() => props.readonly || (props.node.kind === 'field' && condition('readonly')))

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
  if (props.interactive && props.model && Object.hasOwn(props.model, props.node.field))
    nextProps[valueProp] = props.model[props.node.field]
  else if (!Object.hasOwn(nextProps, valueProp) && props.node.defaultValue !== undefined)
    nextProps[valueProp] = props.node.defaultValue

  const trigger = definition.runtime.trigger ?? `update:${valueProp}`
  nextProps[eventPropName(trigger)] = (...args: unknown[]) => {
    if (!props.interactive)
      return
    emit('updateField', props.node.kind === 'field' ? props.node.field : '', definition.runtime.getValueFromEvent
      ? definition.runtime.getValueFromEvent(...args)
      : args[0])
  }
  if (definition.runtime.blurTrigger)
    nextProps[eventPropName(definition.runtime.blurTrigger)] = () => undefined
  if (fieldReadonly.value)
    nextProps[definition.runtime.readonlyProp ?? 'readonly'] = true
  if (disabled.value)
    nextProps.disabled = true
  if (required.value)
    nextProps['aria-required'] = true
  return nextProps
})

const readonlyContent = computed(() => {
  if (!fieldReadonly.value || props.node.kind !== 'field')
    return ''

  const definition = material.value
  const valueProp = definition?.runtime.valueProp ?? 'modelValue'
  const value = componentProps.value[valueProp]
  return definition?.runtime.readonlyRender?.({
    componentProps: props.node.props ?? {},
    model: props.model ?? {},
    node: props.node,
    value,
  }) ?? formatConfigFormReadonlyValue(value)
})
</script>

<template>
  <div
    class="mx-config-form-designer__node-preview"
    :class="{
      'is-field': node.kind === 'field',
      'is-container': node.kind === 'container',
      'is-unsupported': !material,
      'is-readonly': fieldReadonly,
      'is-interactive': interactive,
      'is-required': required,
      'has-label': node.kind === 'field' && Boolean(node.label),
      'is-label-left': node.kind === 'field' && labelPosition !== 'top',
      'is-label-top': node.kind === 'field' && labelPosition === 'top',
    }"
  >
    <template v-if="material">
      <div v-if="node.kind === 'field' && node.label" class="mx-config-form-designer__node-preview-label" :data-required="required">
        {{ node.label }}
      </div>
      <div
        class="mx-config-form-designer__node-preview-real"
        :class="{ 'is-field': node.kind === 'field' }"
      >
        <div
          v-if="node.kind === 'field'"
          class="mx-config-form-designer__node-preview-control"
          :inert="interactive ? undefined : true"
          :aria-hidden="interactive ? undefined : 'true'"
        >
          <span v-if="fieldReadonly" class="mx-config-form-designer__node-preview-readonly" aria-readonly="true"><DesignerReadonlyContent :content="readonlyContent" /></span>
          <component v-else :is="material.runtime.component" v-bind="componentProps" />
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
