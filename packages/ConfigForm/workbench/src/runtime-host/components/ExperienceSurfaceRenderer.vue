<script setup lang="ts">
import type {
  ConfigFormRendererExpose,
  ConfigFormRendererProps,
} from '@moluoxixi/config-form'
import type { ModelJsonObject } from '@moluoxixi/config-form-model'
import type {
  MaterialSemanticTrigger,
  PrimaryUiActionBinding,
  PrototypeInstanceProjectionV1,
  PrototypeNodeAddressV1,
} from '@moluoxixi/config-form-prototype-runtime/session'
import type { PrototypeVueSurfaceRendererBindings } from '@moluoxixi/config-form-prototype-runtime/vue'
import type { VueSurfaceRuntimeArtifact } from '@moluoxixi/config-form-vue-backend'
import type { RuntimeHostFormStateSnapshotV7 } from '../types'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { createPrototypeInstanceRuntimeSnapshot } from '@moluoxixi/config-form-prototype-runtime/session'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
} from 'vue'
import { cloneWorkbenchJson } from '../../utils'

interface ExperienceSurfaceRendererProps {
  artifact: VueSurfaceRuntimeArtifact
  bindings: PrototypeVueSurfaceRendererBindings
  namespace?: string
}

interface ExperienceSurfaceRendererStateEvent {
  focusedAddress?: PrototypeNodeAddressV1
  instanceId: string
  state: RuntimeHostFormStateSnapshotV7
  surfaceId: string
}

interface FieldChangePayload {
  address?: PrototypeNodeAddressV1
  field: string
  scope?: PrototypeNodeAddressV1['scope']
  values?: ModelJsonObject
}

type RuntimeReactionProjection = NonNullable<
  ConfigFormRendererProps<ModelJsonObject>['reactionProjection']
>

const props = defineProps<ExperienceSurfaceRendererProps>()
const emit = defineEmits<{
  error: [error: Error]
  state: [event: ExperienceSurfaceRendererStateEvent]
}>()

const root = useTemplateRef<HTMLElement>('root')
const renderer = useTemplateRef<ConfigFormRendererExpose<ModelJsonObject>>('renderer')
const values = shallowRef<ModelJsonObject>(cloneWorkbenchJson(props.bindings.values))
const projection = shallowRef<PrototypeInstanceProjectionV1>(
  cloneWorkbenchJson(props.bindings.projection),
)
const focusedAddress = shallowRef<PrototypeNodeAddressV1>()
const rendererRevision = ref(0)
let disposed = false
let unregister: (() => void) | undefined

const model = {
  read: () => values.value,
  write: (next: ModelJsonObject) => {
    values.value = cloneWorkbenchJson(next)
  },
}

function sameScope(
  left: PrototypeNodeAddressV1['scope'],
  right: PrototypeNodeAddressV1['scope'],
): boolean {
  return left.length === right.length && left.every((entry, index) => (
    entry.scopeId === right[index]?.scopeId && entry.rowId === right[index]?.rowId
  ))
}

function sameRowPath(address: PrototypeNodeAddressV1, rowIds: readonly string[]): boolean {
  return address.scope.length === rowIds.length
    && address.scope.every((entry, index) => entry.rowId === rowIds[index])
}

function primaryBindings(trigger: MaterialSemanticTrigger): PrimaryUiActionBinding[] {
  return props.bindings.surface.interactions.filter(
    (interaction): interaction is PrimaryUiActionBinding => (
      interaction.kind === 'primaryUiAction' && interaction.trigger === trigger
    ),
  )
}

function eventOrigin(event: Event): Element | undefined {
  if (event.type === 'submit' && 'submitter' in event && event.submitter instanceof Element)
    return event.submitter
  return event.target instanceof Element ? event.target : undefined
}

function rowIdsFor(element: Element): string[] {
  const rowIds: string[] = []
  let current: Element | null = element
  while (current && current !== root.value) {
    if (current.hasAttribute('data-config-form-row')) {
      const rowId = current.getAttribute('data-row-id')
      if (rowId)
        rowIds.unshift(rowId)
    }
    current = current.parentElement
  }
  return rowIds
}

function addressFor(nodeId: string, element?: Element): PrototypeNodeAddressV1 | undefined {
  const candidates = props.bindings.instance.runtime.nodeAddresses
    .filter(address => address.nodeId === nodeId)
  if (!element)
    return candidates.length === 1 ? cloneWorkbenchJson(candidates[0]!) : undefined
  const rowIds = rowIdsFor(element)
  const address = candidates.find(candidate => sameRowPath(candidate, rowIds))
  return address ? cloneWorkbenchJson(address) : undefined
}

function semanticSource(trigger: MaterialSemanticTrigger, event: Event): {
  address: PrototypeNodeAddressV1
  binding: PrimaryUiActionBinding
} | undefined {
  const bindings = primaryBindings(trigger)
  if (bindings.length === 0)
    return undefined

  const origin = eventOrigin(event)
  const nodeElement = origin?.closest('[data-config-node-id]')
  if (nodeElement && root.value?.contains(nodeElement)) {
    const nodeId = nodeElement.getAttribute('data-config-node-id')
    const binding = bindings.find(candidate => candidate.nodeId === nodeId)
    const address = nodeId ? addressFor(nodeId, nodeElement) : undefined
    if (binding && address)
      return { address, binding }
    return undefined
  }

  if (trigger !== 'submit' || bindings.length !== 1)
    return undefined
  const binding = bindings[0]!
  const address = addressFor(binding.nodeId)
  return address ? { address, binding } : undefined
}

async function activateSemantic(trigger: MaterialSemanticTrigger, event: Event): Promise<void> {
  if (disposed)
    return
  const source = semanticSource(trigger, event)
  if (!source)
    return
  try {
    await props.bindings.activate({
      sourceAddress: source.address,
      interactionId: source.binding.id,
    })
  }
  catch (error) {
    emit('error', error instanceof Error ? error : new Error(String(error)))
  }
}

function handleActivate(event: MouseEvent): void {
  const origin = eventOrigin(event)
  if (
    event.defaultPrevented
    || event.button !== 0
    || origin?.closest('[disabled], [aria-disabled="true"], [data-config-form-row-action]')
  ) {
    return
  }
  void activateSemantic('activate', event)
}

function handleSubmit(event: Event): void {
  void activateSemantic('submit', event)
}

function projectionKey(address: PrototypeNodeAddressV1): string {
  void rendererRevision.value
  try {
    return renderer.value?.getInstanceKey(address) ?? address.nodeId
  }
  catch {
    return address.nodeId
  }
}

function setNestedProperty(
  target: Record<string, unknown>,
  path: readonly string[],
  value: unknown,
): void {
  let current = target
  path.forEach((segment, index) => {
    if (index === path.length - 1) {
      current[segment] = cloneWorkbenchJson(value)
      return
    }
    const child = current[segment]
    if (typeof child === 'object' && child !== null && !Array.isArray(child)) {
      current = child as Record<string, unknown>
      return
    }
    const next: Record<string, unknown> = {}
    current[segment] = next
    current = next
  })
}

const reactionProjection = computed<RuntimeReactionProjection>(() => {
  const states: RuntimeReactionProjection['states'] = {}
  const projectedProps: RuntimeReactionProjection['props'] = {}
  projection.value.forEach((entry) => {
    const key = projectionKey(entry.address)
    if (Object.keys(entry.states).length > 0)
      states[key] = { ...entry.states }
    if (entry.properties.length > 0) {
      const target: Record<string, unknown> = {}
      entry.properties.forEach(property => setNestedProperty(target, property.path, property.value))
      projectedProps[key] = target
    }
  })
  return {
    values: values.value,
    props: projectedProps,
    states,
    validate: [],
  }
})

function currentState(): RuntimeHostFormStateSnapshotV7 {
  const currentRenderer = renderer.value
  const fields = (currentRenderer?.listFieldInstances() ?? []).map(instance => ({
    address: cloneWorkbenchJson(instance.address),
    instanceKey: instance.instanceKey,
    valuePath: [...instance.valuePath],
  }))
  return {
    fields,
    touched: fields.filter(field => currentRenderer?.getInstanceMeta(field.address).touched)
      .map(field => field.instanceKey),
    validation: Object.fromEntries(fields.flatMap((field) => {
      const errors = currentRenderer?.getInstanceErrors(field.address) ?? []
      return errors.length > 0 ? [[field.instanceKey, [...errors]]] : []
    })),
    values: cloneWorkbenchJson(currentRenderer?.getValues() ?? values.value),
  }
}

function emitState(): void {
  if (disposed)
    return
  emit('state', {
    instanceId: props.bindings.instance.instanceId,
    surfaceId: props.bindings.instance.surfaceId,
    state: currentState(),
    ...(focusedAddress.value
      ? { focusedAddress: cloneWorkbenchJson(focusedAddress.value) }
      : {}),
  })
}

function replaceValues(nextValues: ModelJsonObject): void {
  values.value = cloneWorkbenchJson(nextValues)
}

function replaceProjection(nextProjection: PrototypeInstanceProjectionV1): void {
  projection.value = cloneWorkbenchJson(nextProjection)
}

function focus(address: PrototypeNodeAddressV1): void {
  focusedAddress.value = cloneWorkbenchJson(address)
  void nextTick(() => {
    if (disposed)
      return
    const instances = renderer.value?.listFieldInstances(address.nodeId) ?? []
    const fieldIndex = instances.findIndex(instance => sameScope(instance.address.scope, address.scope))
    const field = fieldIndex < 0 ? undefined : instances[fieldIndex]
    const shells = Array.from(root.value?.querySelectorAll<HTMLElement>('[data-field]') ?? [])
      .filter(element => element.dataset.field === field?.field)
    const shell = fieldIndex < 0 ? undefined : shells[fieldIndex]
    const target = shell?.querySelector<HTMLElement>(
      'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? shell ?? root.value
    target?.focus()
    emitState()
  })
}

async function validateFields(addresses: readonly PrototypeNodeAddressV1[]): Promise<boolean> {
  const currentRenderer = renderer.value
  if (!currentRenderer)
    return false
  const results = await Promise.all(addresses.map(address => currentRenderer.validateInstance(address)))
  return results.every(Boolean)
}

function resolveChangedAddress(payload: FieldChangePayload): PrototypeNodeAddressV1 | undefined {
  if (payload.address)
    return cloneWorkbenchJson(payload.address)
  const candidates = renderer.value?.listFieldInstances()
    .filter(instance => instance.field === payload.field) ?? []
  const scope = payload.scope ?? []
  return candidates.find(instance => sameScope(instance.address.scope, scope))?.address
}

function handleFieldChange(payload: FieldChangePayload): void {
  const nextValues = cloneWorkbenchJson(payload.values ?? renderer.value?.getValues() ?? values.value)
  values.value = nextValues
  const address = resolveChangedAddress(payload)
  if (!address) {
    emit('error', new Error(`Runtime field change has no live address: ${payload.field}.`))
    emitState()
    return
  }
  const runtime = createPrototypeInstanceRuntimeSnapshot(
    props.bindings.surface,
    nextValues,
    props.bindings.createRowIdFactory(),
  )
  if (!runtime.success) {
    emit('error', new Error(runtime.diagnostics.map(item => item.message).join('\n')))
    emitState()
    return
  }
  props.bindings.valuesChanged({
    values: nextValues,
    runtime: runtime.data,
    originScope: cloneWorkbenchJson(payload.scope ?? address.scope),
    changedAddresses: [cloneWorkbenchJson(address)],
  })
  emitState()
}

onMounted(() => {
  unregister = props.bindings.registerController({
    replaceValues: replacement => replaceValues(replacement.values),
    replaceProjection,
    validateSurface: () => renderer.value?.validate() ?? false,
    validateFields,
    focus,
    dispose: () => {
      disposed = true
    },
  })
  rendererRevision.value += 1
  void nextTick(emitState)
})

onBeforeUnmount(() => {
  disposed = true
  unregister?.()
})
</script>

<template>
  <div
    ref="root"
    class="runtime-host-experience-instance"
    @click="handleActivate"
    @submit="handleSubmit"
  >
    <ConfigFormRenderer
      ref="renderer"
      :model="model"
      :namespace="namespace"
      :reaction-projection="reactionProjection"
      class="surface-experience-form"
      mode="preview"
      v-bind="artifact.renderer"
      @field-change="handleFieldChange"
      @errors-change="emitState"
      @meta-change="emitState"
    />
  </div>
</template>
