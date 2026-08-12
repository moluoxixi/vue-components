<script setup lang="ts">
import type { DesignerFormSettings, DesignerNode } from '../document'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../registry'
import type { ConfigFormComponentRegistration } from '@moluoxixi/config-form-headless'
import type { PropType, VNodeChild } from 'vue'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import { computed, defineComponent, markRaw, toRaw } from 'vue'
import { formatConfigFormReadonlyValue, isConfigFormComponentRegistration } from '@moluoxixi/config-form-headless'
import { resolveConfigFormFieldLayout } from '@moluoxixi/config-form/renderer'
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
  reactionProps?: ConfigFormReactionProjection['props']
  reactionStates?: ConfigFormReactionProjection['states']
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
const runtimeComponentReference = computed(() => (
  material.value?.runtime.designerComponent ?? material.value?.runtime.component
))
const runtimeRegistration = computed<ConfigFormComponentRegistration | undefined>(() => {
  const component = runtimeComponentReference.value
  if (typeof component !== 'string')
    return undefined
  if (!Object.hasOwn(props.registry.components, component))
    return undefined
  const registered = props.registry.components[component]
  return isConfigFormComponentRegistration(registered) ? registered : undefined
})
const runtimeComponent = computed(() => {
  const component = runtimeComponentReference.value
  if (typeof component !== 'string')
    return rawComponent(component)
  const registered = Object.hasOwn(props.registry.components, component)
    ? props.registry.components[component]
    : undefined
  return rawComponent(runtimeRegistration.value?.component ?? registered ?? component)
})
const rendererNamespace = computed(() => props.registry.rendererNamespace)
const hasLabel = computed(() => props.node.kind === 'field' && Boolean(props.node.label))
const fieldLayout = computed(() => resolveConfigFormFieldLayout(
  props.labelPosition ?? 'left',
  hasLabel.value,
))
const controlId = computed(() => props.node.kind === 'field'
  ? `${rendererNamespace.value}-${props.node.id.replace(/[^a-z0-9_-]+/gi, '-')}-control`
  : undefined)

function condition(target: 'required' | 'disabled' | 'readonly', fallback = false): boolean {
  if (props.node.kind === 'field') {
    const reactionValue = props.reactionStates?.[props.node.field]?.[target]
    if (reactionValue !== undefined)
      return reactionValue
  }
  const expression = props.node.conditions?.[target]
  return expression
    ? evaluateDesignerCondition(expression, props.model ?? {})
    : fallback
}

const required = computed(() => props.node.kind === 'field' && condition('required'))
const disabled = computed(() => props.node.kind === 'field' && condition('disabled'))
const fieldReadonly = computed(() => props.readonly || (props.node.kind === 'field' && condition('readonly')))

function eventPropName(eventName: string): string {
  return `on${eventName.slice(0, 1).toUpperCase()}${eventName.slice(1)}`
}


function rawComponent<T>(component: T): T {
  return component !== null && typeof component === 'object'
    ? markRaw(toRaw(component)) as T
    : component
}

const componentProps = computed<Record<string, unknown>>(() => {
  const definition = material.value
  if (!definition)
    return {}

  const nextProps: Record<string, unknown> = {
    ...runtimeRegistration.value?.props,
    ...(props.node.props ?? {}),
    ...(props.node.kind === 'field' ? props.reactionProps?.[props.node.field] : undefined),
  }
  if (props.node.kind !== 'field') {
    if (definition.runtime.designerComponent)
      nextProps.designerNode = props.node
    return nextProps
  }

  if (!Object.hasOwn(nextProps, 'id'))
    nextProps.id = controlId.value

  const valueProp = definition.runtime.valueProp ?? runtimeRegistration.value?.valueProp ?? 'modelValue'
  if (props.model && Object.hasOwn(props.model, props.node.field))
    nextProps[valueProp] = props.model[props.node.field]
  else if (!Object.hasOwn(nextProps, valueProp) && props.node.defaultValue !== undefined)
    nextProps[valueProp] = props.node.defaultValue

  const trigger = definition.runtime.trigger ?? runtimeRegistration.value?.trigger ?? `update:${valueProp}`
  nextProps[eventPropName(trigger)] = (...args: unknown[]) => {
    if (!props.interactive)
      return
    const getValueFromEvent = definition.runtime.getValueFromEvent ?? runtimeRegistration.value?.getValueFromEvent
    emit('updateField', props.node.kind === 'field' ? props.node.field : '', getValueFromEvent
      ? getValueFromEvent(...args)
      : args[0])
  }
  const blurTrigger = definition.runtime.blurTrigger ?? runtimeRegistration.value?.blurTrigger
  if (blurTrigger)
    nextProps[eventPropName(blurTrigger)] = () => undefined
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
  const valueProp = definition?.runtime.valueProp ?? runtimeRegistration.value?.valueProp ?? 'modelValue'
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
    :class="[
      {
        'is-field': node.kind === 'field',
        'is-container': node.kind === 'container',
        'is-unsupported': !material,
        'is-readonly': fieldReadonly,
        'is-interactive': interactive,
        'is-required': required,
        'has-label': hasLabel,
        'is-label-left': node.kind === 'field' && labelPosition !== 'top',
        'is-label-top': node.kind === 'field' && labelPosition === 'top',
      },
      node.kind === 'field' ? `${rendererNamespace}__field` : undefined,
      node.kind === 'field' ? `${rendererNamespace}__field--label-${labelPosition ?? 'left'}` : undefined,
    ]"
    :data-field="node.kind === 'field' ? node.field : undefined"
    :data-label-position="node.kind === 'field' ? (labelPosition ?? 'left') : undefined"
    :data-required="node.kind === 'field' ? required : undefined"
    :style="node.kind === 'field' ? fieldLayout.field : undefined"
  >
    <template v-if="material">
      <label
        v-if="node.kind === 'field' && node.label"
        class="mx-config-form-designer__node-preview-label"
        :class="`${rendererNamespace}__label`"
        :for="controlId"
      >
        {{ node.label }}
      </label>
      <div
        class="mx-config-form-designer__node-preview-real"
        :class="{ 'is-field': node.kind === 'field' }"
      >
        <div
          v-if="node.kind === 'field'"
          class="mx-config-form-designer__node-preview-control"
          :class="`${rendererNamespace}__control`"
          :style="fieldLayout.control"
          :inert="interactive ? undefined : true"
          :aria-hidden="interactive ? undefined : 'true'"
        >
          <span
            v-if="fieldReadonly"
            class="mx-config-form-designer__node-preview-readonly"
            :class="`${rendererNamespace}__readonly`"
            :id="controlId"
            aria-readonly="true"
          ><DesignerReadonlyContent :content="readonlyContent" /></span>
          <component v-else :is="runtimeComponent" v-bind="componentProps" />
        </div>
        <component v-else :is="runtimeComponent" v-bind="componentProps">
          <template v-for="slot in materialSlots" :key="slot.name" #[slot.name]>
            <slot :name="slot.name" />
          </template>
        </component>
      </div>
    </template>
  </div>
</template>
