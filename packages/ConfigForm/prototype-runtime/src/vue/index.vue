<script setup lang="ts">
import type { CSSProperties, ComponentPublicInstance } from 'vue'
import type {
  PrototypeNodeAddressV1,
  PrototypeSurfaceContractV1,
  SurfaceInstanceId,
  SurfaceInstanceV1,
} from '../session'
import type {
  PrototypeSurfaceHostEmits,
  PrototypeSurfaceHostExpose,
  PrototypeSurfaceHostProps,
  PrototypeVueActivationInput,
  PrototypeVueActivationResult,
  PrototypeVueHostController,
  PrototypeVueSurfaceRendererBindings,
  PrototypeVueTransitionSnapshot,
} from './types'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  markRaw,
  ref,
  shallowRef,
  toRaw,
  watch,
} from 'vue'
import { createPrototypeVueHostController } from './services'

type PrototypeOverlaySurface = Exclude<PrototypeSurfaceContractV1, { kind: 'page' }>

defineOptions({ name: 'PrototypeSurfaceHost' })

const props = withDefaults(defineProps<PrototypeSurfaceHostProps>(), {
  homeInstanceId: 'prototype-page-1',
  teleportTo: 'body',
})
const emit = defineEmits<PrototypeSurfaceHostEmits>()

const snapshot = shallowRef<PrototypeVueTransitionSnapshot>()
const registryRevision = ref(0)
const overlayPanels = new Map<string, HTMLElement>()
const rendererBindingsByInstance = new Map<SurfaceInstanceId, PrototypeVueSurfaceRendererBindings>()
let host: PrototypeVueHostController
let unsubscribeRegistry: (() => void) | undefined

function toPlainSnapshot<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (typeof value !== 'object' || value === null)
    return value
  const raw = toRaw(value as object) as object
  const previous = seen.get(raw)
  if (previous !== undefined)
    return previous as T
  if (Array.isArray(raw)) {
    const result: unknown[] = []
    seen.set(raw, result)
    raw.forEach(item => result.push(toPlainSnapshot(item, seen)))
    return result as T
  }
  const result: Record<string, unknown> = {}
  seen.set(raw, result)
  Object.entries(raw).forEach(([key, item]) => {
    result[key] = toPlainSnapshot(item, seen)
  })
  return result as T
}

function acceptSnapshot(next: PrototypeVueTransitionSnapshot): void {
  const liveInstanceIds = new Set([...next.session.pageHistory, ...next.session.overlayStack])
  rendererBindingsByInstance.forEach((_, instanceId) => {
    if (!liveInstanceIds.has(instanceId))
      rendererBindingsByInstance.delete(instanceId)
  })
  snapshot.value = next
  emit('transition', next)
  if (next.diagnostics.length > 0)
    emit('diagnostics', { diagnostics: next.diagnostics, snapshot: next })
}

function createHost(): PrototypeVueHostController {
  return createPrototypeVueHostController({
    context: toPlainSnapshot(props.context),
    homeInstanceId: props.homeInstanceId,
    ...(props.session ? { initialSession: toPlainSnapshot(props.session) } : {}),
    ...(props.createInstanceId ? { createInstanceId: props.createInstanceId } : {}),
    ...(props.createRowId ? { createRowId: props.createRowId } : {}),
    ...(props.createRuntimeSnapshot ? { createRuntimeSnapshot: props.createRuntimeSnapshot } : {}),
    scheduleFocus: callback => void nextTick(callback),
    onSnapshot: acceptSnapshot,
  })
}

function resetHost(): void {
  unsubscribeRegistry?.()
  host?.dispose()
  rendererBindingsByInstance.clear()
  host = createHost()
  snapshot.value = host.getSnapshot()
  unsubscribeRegistry = host.registry.subscribe(() => {
    registryRevision.value += 1
  })
  registryRevision.value += 1
}

resetHost()

watch(
  () => [
    props.context,
    props.homeInstanceId,
    props.createInstanceId,
    props.createRowId,
    props.createRuntimeSnapshot,
  ] as const,
  resetHost,
  { flush: 'sync' },
)

watch(
  () => props.session,
  (nextSession) => {
    if (nextSession === host.getSnapshot().session)
      return
    if (nextSession === undefined) {
      resetHost()
      return
    }
    host.replaceSession(toPlainSnapshot(nextSession))
  },
  { deep: true, flush: 'sync' },
)

const session = computed(() => snapshot.value!.session)
const pageInstanceIds = computed(() => {
  void registryRevision.value
  return session.value.pageHistory.filter(instanceId => host.registry.has(instanceId))
})
const overlayInstanceIds = computed(() => {
  void registryRevision.value
  return session.value.overlayStack.filter(instanceId => host.registry.has(instanceId))
})
const activePageInstanceId = computed(() => pageInstanceIds.value.at(-1))
const topOverlayInstanceId = computed(() => overlayInstanceIds.value.at(-1))
const teleportDisabled = computed(() => props.teleportTo === false)
const teleportTarget = computed(() => props.teleportTo === false ? 'body' : props.teleportTo)

function instanceById(instanceId: string): SurfaceInstanceV1 {
  const instance = session.value.instancesById[instanceId]
  if (!instance)
    throw new Error(`Prototype instance does not exist: ${instanceId}.`)
  return instance
}

function surfaceByInstance(instanceId: string): PrototypeSurfaceContractV1 {
  const instance = instanceById(instanceId)
  const surface = props.context.surfacesById[instance.surfaceId]
  if (!surface)
    throw new Error(`Prototype Surface does not exist: ${instance.surfaceId}.`)
  return surface
}

function overlaySurfaceByInstance(instanceId: string): PrototypeOverlaySurface {
  const surface = surfaceByInstance(instanceId)
  if (surface.kind === 'page')
    throw new Error(`Prototype overlay instance references a Page Surface: ${instanceId}.`)
  return surface
}

function rendererBindings(instanceId: string): PrototypeVueSurfaceRendererBindings {
  const cached = rendererBindingsByInstance.get(instanceId)
  if (cached)
    return cached
  const bindings: PrototypeVueSurfaceRendererBindings = {
    get instance() {
      return instanceById(instanceId)
    },
    get surface() {
      return surfaceByInstance(instanceId)
    },
    get values() {
      void registryRevision.value
      const instance = instanceById(instanceId)
      return host.registry.get(instanceId)?.values ?? instance.values
    },
    get projection() {
      void registryRevision.value
      const instance = instanceById(instanceId)
      return host.registry.get(instanceId)?.projection ?? instance.projection
    },
    createRowIdFactory: () => host.createRowIdFactory(instanceId),
    registerController: controller => host.registry.register(instanceId, controller),
    activate: input => activate({
      sourceInstanceId: instanceId,
      sourceAddress: input.sourceAddress,
      interactionId: input.interactionId,
      ...(input.item ? { item: input.item } : {}),
    }),
    valuesChanged: input => host.valuesChanged({ instanceId, ...input }),
  }
  rendererBindingsByInstance.set(instanceId, bindings)
  return bindings
}

function artifactFor(instanceId: string) {
  const instance = instanceById(instanceId)
  const artifact = props.artifactsBySurfaceId[instance.surfaceId]
  return artifact?.surfaceId === instance.surfaceId ? artifact : undefined
}

function artifactComponent(instanceId: string) {
  const artifact = artifactFor(instanceId)
  return artifact ? markRaw(toRaw(artifact.component)) : undefined
}

function validationGate(input: PrototypeVueActivationInput) {
  const instance = session.value.instancesById[input.sourceInstanceId]
  const surface = instance ? props.context.surfacesById[instance.surfaceId] : undefined
  const interaction = surface?.interactions.find(candidate => (
    candidate.kind === 'primaryUiAction' && candidate.id === input.interactionId
  ))
  return interaction?.kind === 'primaryUiAction' ? interaction.validate : undefined
}

async function activate(input: PrototypeVueActivationInput): Promise<PrototypeVueActivationResult> {
  const gate = validationGate(input)
  const result = await host.activate(input)
  if (gate && result.status === 'validation-failed') {
    emit('validationFailed', {
      instanceId: input.sourceInstanceId,
      interactionId: input.interactionId,
      gate,
    })
  }
  return result
}

function lengthValue(length: { value: number, unit: string }): string {
  return `${length.value}${length.unit}`
}

function overlayStyle(surface: PrototypeOverlaySurface): CSSProperties {
  const length = surface.kind === 'dialog' ? surface.presentation.width : surface.presentation.size
  const tablet = length.tablet ?? length.desktop
  const mobile = length.mobile ?? tablet
  return {
    '--prototype-overlay-size-desktop': lengthValue(length.desktop),
    '--prototype-overlay-size-tablet': lengthValue(tablet),
    '--prototype-overlay-size-mobile': lengthValue(mobile),
  } as CSSProperties
}

function overlayLayerStyle(index: number): CSSProperties {
  return { zIndex: 1000 + index * 2 }
}

function drawerPlacementClass(instanceId: string): string | undefined {
  const surface = overlaySurfaceByInstance(instanceId)
  return surface.kind === 'drawer'
    ? `mx-prototype-host__overlay--${surface.presentation.placement}`
    : undefined
}

function setOverlayPanel(
  instanceId: string,
  value: Element | ComponentPublicInstance | null,
): void {
  const element = value instanceof HTMLElement
    ? value
    : value && '$el' in value && value.$el instanceof HTMLElement
      ? value.$el
      : undefined
  if (element)
    overlayPanels.set(instanceId, element)
  else
    overlayPanels.delete(instanceId)
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',')
  return Array.from(container.querySelectorAll<HTMLElement>(selector))
    .filter(element => element.getAttribute('aria-hidden') !== 'true')
}

function trapOverlayFocus(event: KeyboardEvent, instanceId: string): void {
  if (event.key !== 'Tab' || topOverlayInstanceId.value !== instanceId)
    return
  const panel = overlayPanels.get(instanceId)
  if (!panel)
    return
  const focusable = focusableElements(panel)
  if (focusable.length === 0) {
    event.preventDefault()
    panel.focus()
    return
  }
  const first = focusable[0]!
  const last = focusable.at(-1)!
  if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function dismissFromMask(instanceId: string): void {
  if (topOverlayInstanceId.value !== instanceId)
    return
  const surface = surfaceByInstance(instanceId)
  if (surface.kind !== 'page' && surface.presentation.mask && surface.presentation.close.mask)
    host.dismiss(instanceId, 'mask')
}

function dismissFromButton(instanceId: string): void {
  if (topOverlayInstanceId.value === instanceId)
    host.dismiss(instanceId, 'button')
}

function handleEscape(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.key !== 'Escape')
    return
  const instanceId = topOverlayInstanceId.value
  if (!instanceId)
    return
  const surface = surfaceByInstance(instanceId)
  if (surface.kind === 'page' || !surface.presentation.close.escape)
    return
  event.preventDefault()
  event.stopPropagation()
  host.dismiss(instanceId, 'escape')
}

watch(topOverlayInstanceId, instanceId => void nextTick(() => {
  if (!instanceId)
    return
  const panel = overlayPanels.get(instanceId)
  const autofocus = panel?.querySelector<HTMLElement>('[autofocus]')
  const first = panel ? focusableElements(panel)[0] : undefined
  ;(autofocus ?? first ?? panel)?.focus()
}))

onMounted(() => document.addEventListener('keydown', handleEscape, true))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscape, true)
  unsubscribeRegistry?.()
  host.dispose()
  overlayPanels.clear()
})

const exposed: PrototypeSurfaceHostExpose = {
  activate,
  back: () => host.back(),
  closeAll: () => host.closeAll(),
  dismiss: (instanceId, reason) => host.dismiss(instanceId, reason),
  dispatch: command => host.dispatch(command),
  getRevision: () => host.getRevision(),
  getSnapshot: () => host.getSnapshot(),
  replaceSession: session => host.replaceSession(toPlainSnapshot(session)),
  valuesChanged: input => host.valuesChanged(input),
}
defineExpose(exposed)
</script>

<template>
  <main class="mx-prototype-host" data-prototype-surface-host>
    <section
      v-for="instanceId in pageInstanceIds"
      :key="instanceId"
      class="mx-prototype-host__page"
      :data-active="instanceId === activePageInstanceId ? 'true' : 'false'"
      :data-instance-id="instanceId"
      :data-surface-id="instanceById(instanceId).surfaceId"
      :hidden="instanceId !== activePageInstanceId"
      :inert="instanceId !== activePageInstanceId ? true : undefined"
      :aria-hidden="instanceId !== activePageInstanceId ? 'true' : undefined"
    >
      <slot
        name="surface"
        :artifact="artifactFor(instanceId)"
        :bindings="rendererBindings(instanceId)"
      >
        <component
          :is="artifactComponent(instanceId)"
          v-if="artifactComponent(instanceId)"
          v-bind="artifactFor(instanceId)!.props"
          :prototype="rendererBindings(instanceId)"
        />
      </slot>
    </section>

    <Teleport :to="teleportTarget" :disabled="teleportDisabled">
      <div v-if="overlayInstanceIds.length > 0" class="mx-prototype-host__overlays">
        <div
          v-for="(instanceId, index) in overlayInstanceIds"
          :key="instanceId"
          class="mx-prototype-host__overlay-layer"
          :class="{
            'mx-prototype-host__overlay-layer--masked': overlaySurfaceByInstance(instanceId).presentation.mask,
          }"
          :style="overlayLayerStyle(index)"
          :data-instance-id="instanceId"
          :data-surface-id="instanceById(instanceId).surfaceId"
          :data-top="instanceId === topOverlayInstanceId ? 'true' : 'false'"
          :inert="instanceId !== topOverlayInstanceId ? true : undefined"
          :aria-hidden="instanceId !== topOverlayInstanceId ? 'true' : undefined"
          @pointerdown.self="dismissFromMask(instanceId)"
        >
          <section
            :ref="(value: Element | ComponentPublicInstance | null) => setOverlayPanel(instanceId, value)"
            class="mx-prototype-host__overlay"
            :class="[
              `mx-prototype-host__overlay--${surfaceByInstance(instanceId).kind}`,
              drawerPlacementClass(instanceId),
            ]"
            :style="overlayStyle(overlaySurfaceByInstance(instanceId))"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="`mx-prototype-title-${instanceId}`"
            tabindex="-1"
            @keydown="trapOverlayFocus($event, instanceId)"
          >
            <header class="mx-prototype-host__overlay-header">
              <h2 :id="`mx-prototype-title-${instanceId}`" class="mx-prototype-host__overlay-title">
                {{ overlaySurfaceByInstance(instanceId).presentation.title }}
              </h2>
              <button
                v-if="overlaySurfaceByInstance(instanceId).presentation.close.button"
                class="mx-prototype-host__overlay-close"
                type="button"
                aria-label="Close"
                @click="dismissFromButton(instanceId)"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </header>
            <div class="mx-prototype-host__overlay-content">
              <slot
                name="surface"
                :artifact="artifactFor(instanceId)"
                :bindings="rendererBindings(instanceId)"
              >
                <component
                  :is="artifactComponent(instanceId)"
                  v-if="artifactComponent(instanceId)"
                  v-bind="artifactFor(instanceId)!.props"
                  :prototype="rendererBindings(instanceId)"
                />
              </slot>
            </div>
          </section>
        </div>
      </div>
    </Teleport>
  </main>
</template>
