<script setup lang="ts">
import type { FormSettings } from '@moluoxixi/config-form-model'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../registry'
import { Search } from '@lucide/vue'
import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useDesignerLocale } from '../locale'
import { createDesignerNodeId } from '../graph'
import { DESIGNER_SESSION_KEY } from './DesignerCanvas/services'
import './DesignerPalette/style'

interface DesignerPaletteMaterialBindings {
  'aria-label': string
  'aria-pressed': boolean
  class: Array<string | Record<string, boolean | undefined>>
  'data-designer-draggable': true
  'data-material-key': string
  'data-material-kind': DesignerMaterialDefinition['kind']
  disabled: boolean | undefined
  onClick: (event: MouseEvent) => void
  onKeydown: (event: KeyboardEvent) => void
  onPointerdown: (event: PointerEvent) => void
  title: string
}

const props = withDefaults(defineProps<{
  materials: DesignerMaterialDefinition[]
  registry?: DesignerRegistry
  form?: FormSettings
  readonly?: boolean
  showSearch?: boolean
}>(), {
  showSearch: true,
})
const locale = useDesignerLocale()

const emit = defineEmits<{
  addMaterial: [materialKey: string]
}>()
defineSlots<{
  content?: (scope: {
    getMaterialBindings: (material: DesignerMaterialDefinition) => DesignerPaletteMaterialBindings
    groups: Array<[string, DesignerMaterialDefinition[]]>
    materialTitle: (material: DesignerMaterialDefinition) => string
  }) => unknown
}>()
const designSession = inject(DESIGNER_SESSION_KEY, undefined)
const dragController = designSession?.drag

const query = ref('')
let activePointerId: number | undefined
let activePointerTarget: HTMLElement | undefined
let dragActivated = false
let suppressClick = false
let keyboardStartFrame: number | undefined
let keyboardStartToken = 0

function cancelKeyboardStart(): void {
  keyboardStartToken += 1
  if (keyboardStartFrame !== undefined)
    window.cancelAnimationFrame(keyboardStartFrame)
  keyboardStartFrame = undefined
}

function beginMaterialKeyboardDrag(materialKey: string): void {
  if (!dragController)
    return
  cancelKeyboardStart()
  const candidateId = createDesignerNodeId('candidate')
  const token = keyboardStartToken
  let attempts = 0
  const attempt = (): void => {
    keyboardStartFrame = undefined
    if (token !== keyboardStartToken || props.readonly || dragController?.session.value)
      return
    if (dragController.beginMaterialKeyboard(materialKey, candidateId))
      return
    if (attempts >= 30)
      return
    attempts += 1
    keyboardStartFrame = window.requestAnimationFrame(attempt)
  }
  // The Canvas registers its target resolver before paint, but its first
  // compiled page can still settle on the next Vue tick. Retry briefly so a
  // fast Space press cannot be lost during that hand-off.
  void nextTick(attempt)
}

const keyboardDragSession = computed(() => {
  const session = dragController?.session.value
  return session?.active && session.input === 'keyboard' ? session : undefined
})

const groups = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  const matched = normalized
    ? props.materials.filter(material => `${locale.materialTitle(material)} ${locale.materialCategory(material)}`.toLowerCase().includes(normalized))
    : props.materials
  const grouped = new Map<string, DesignerMaterialDefinition[]>()
  for (const material of matched) {
    const category = locale.materialCategory(material)
    const entries = grouped.get(category) ?? []
    entries.push(material)
    grouped.set(category, entries)
  }
  return [...grouped.entries()]
})

function handlePointerMove(event: PointerEvent): void {
  if (event.pointerId !== activePointerId)
    return
  dragActivated = dragController?.move({ x: event.clientX, y: event.clientY }) ?? false
  if (dragActivated)
    event.preventDefault()
}

function cleanupPointerDrag(): void {
  activePointerTarget?.removeEventListener('lostpointercapture', handlePointerLostCapture)
  if (activePointerId !== undefined && activePointerTarget?.hasPointerCapture?.(activePointerId))
    activePointerTarget.releasePointerCapture(activePointerId)
  activePointerId = undefined
  activePointerTarget = undefined
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('pointercancel', handlePointerCancel)
}

function handlePointerLostCapture(event: PointerEvent): void {
  if (event.pointerId !== activePointerId)
    return
  dragController?.cancel()
  cleanupPointerDrag()
  dragActivated = false
}

function handlePointerUp(event: PointerEvent): void {
  if (event.pointerId !== activePointerId)
    return
  const wasActive = dragActivated
  dragController?.finish({ x: event.clientX, y: event.clientY })
  cleanupPointerDrag()
  dragActivated = false
  if (!wasActive)
    return
  suppressClick = true
  window.setTimeout(() => {
    suppressClick = false
  }, 0)
}

function handlePointerCancel(event: PointerEvent): void {
  if (event.pointerId !== activePointerId)
    return
  dragController?.cancel()
  cleanupPointerDrag()
  dragActivated = false
}

function prepareMaterialDrag(material: DesignerMaterialDefinition, event: PointerEvent): void {
  if (props.readonly || event.button !== 0 || !dragController)
    return
  if (event.pointerType !== 'touch')
    event.preventDefault()
  dragController.cancel()
  activePointerId = event.pointerId
  activePointerTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
  activePointerTarget?.setPointerCapture?.(event.pointerId)
  activePointerTarget?.addEventListener('lostpointercapture', handlePointerLostCapture)
  dragActivated = false
  dragController.beginMaterial(material.key, createDesignerNodeId('candidate'), {
    x: event.clientX,
    y: event.clientY,
  })
  window.addEventListener('pointermove', handlePointerMove, { passive: false })
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('pointercancel', handlePointerCancel)
}

function addMaterial(materialKey: string): void {
  if (props.readonly || suppressClick)
    return
  emit('addMaterial', materialKey)
}

function isMaterialKeyboardDragging(materialKey: string): boolean {
  const source = keyboardDragSession.value?.source
  return source?.type === 'material' && source.materialKey === materialKey
}

function handleMaterialKeydown(material: DesignerMaterialDefinition, event: KeyboardEvent): void {
  if (props.readonly)
    return

  if (event.key === 'Enter') {
    event.preventDefault()
    event.stopPropagation()
    dragController?.cancel()
    addMaterial(material.key)
    return
  }

  const keyboardSession = keyboardDragSession.value
  if (event.key === 'Escape' && keyboardSession) {
    event.preventDefault()
    event.stopPropagation()
    cancelKeyboardStart()
    dragController?.cancel()
    return
  }
  if (event.key.startsWith('Arrow') && keyboardSession) {
    event.preventDefault()
    event.stopPropagation()
    dragController?.moveKeyboard(event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 'next' : 'previous')
    return
  }
  if (event.key !== ' ' || !dragController)
    return

  event.preventDefault()
  event.stopPropagation()
  if (keyboardSession)
    dragController.finishKeyboard()
  else
    beginMaterialKeyboardDrag(material.key)
}

function getMaterialBindings(material: DesignerMaterialDefinition): DesignerPaletteMaterialBindings {
  return {
    'aria-label': locale.materialTitle(material),
    'aria-pressed': isMaterialKeyboardDragging(material.key),
    'class': [
      'mx-config-form-designer__palette-command',
      {
        'is-disabled': props.readonly,
        'is-keyboard-dragging': isMaterialKeyboardDragging(material.key),
      },
    ],
    'data-designer-draggable': true,
    'data-material-key': material.key,
    'data-material-kind': material.kind,
    'disabled': props.readonly,
    'onClick': (event: MouseEvent) => {
      event.stopPropagation()
      addMaterial(material.key)
    },
    'onKeydown': (event: KeyboardEvent) => handleMaterialKeydown(material, event),
    'onPointerdown': (event: PointerEvent) => prepareMaterialDrag(material, event),
    'title': locale.materialTitle(material),
  }
}

onBeforeUnmount(() => {
  cancelKeyboardStart()
  dragController?.cancel()
  cleanupPointerDrag()
})

watch(() => props.readonly, (readonly) => {
  if (!readonly)
    return
  dragController?.cancel()
  cancelKeyboardStart()
  cleanupPointerDrag()
  dragActivated = false
})
</script>

<template>
  <aside class="mx-config-form-designer__palette" :aria-label="locale.t('palette.materials', 'Materials')">
    <div v-if="showSearch" class="mx-config-form-designer__search">
      <Search :size="16" aria-hidden="true" />
      <input v-model="query" type="search" :placeholder="locale.t('palette.search', 'Search')" :aria-label="locale.t('palette.searchMaterials', 'Search materials')">
    </div>
    <slot
      name="content"
      :groups="groups"
      :get-material-bindings="getMaterialBindings"
      :material-title="locale.materialTitle"
    >
    <div class="mx-config-form-designer__palette-list">
      <section v-for="[category, entries] in groups" :key="category" class="mx-config-form-designer__palette-group">
        <h2>{{ category }}</h2>
        <div class="mx-config-form-designer__palette-items">
          <div
            v-for="material in entries"
            :key="material.key"
            class="mx-config-form-designer__palette-item"
            :class="{
              'is-disabled': readonly,
              'is-keyboard-dragging': isMaterialKeyboardDragging(material.key),
            }"
            :data-material-row-key="material.key"
            :data-material-kind="material.kind"
          >
            <button
              v-bind="getMaterialBindings(material)"
              type="button"
              class="mx-config-form-designer__palette-item-action"
            />
            <span class="mx-config-form-designer__palette-item-summary" aria-hidden="true">
              <component :is="material.icon" v-if="material.icon" :size="17" aria-hidden="true" />
              <span class="mx-config-form-designer__palette-icon" v-else aria-hidden="true">
                {{ material.kind === 'field' ? 'F' : 'L' }}
              </span>
              <span class="mx-config-form-designer__palette-item-name">{{ locale.materialTitle(material) }}</span>
            </span>
          </div>
        </div>
      </section>
      <p v-if="groups.length === 0" class="mx-config-form-designer__empty-state">{{ locale.t('palette.empty', 'No materials') }}</p>
    </div>
    </slot>
  </aside>
</template>
