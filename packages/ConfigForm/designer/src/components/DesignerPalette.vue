<script setup lang="ts">
import type { DesignerFormSettings } from '../document'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../registry'
import { Search } from '@lucide/vue'
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { useDesignerLocale } from '../locale'
import { createDesignerNodeId } from '../history'
import DesignerMaterialSpecimen from './DesignerMaterialSpecimen.vue'
import { DESIGNER_DRAG_KEY } from './designer-drag'

const props = defineProps<{
  materials: DesignerMaterialDefinition[]
  registry?: DesignerRegistry
  form?: DesignerFormSettings
  readonly?: boolean
}>()
const locale = useDesignerLocale()

const emit = defineEmits<{
  addMaterial: [materialKey: string]
}>()
const dragController = inject(DESIGNER_DRAG_KEY, undefined)

const query = ref('')
let activePointerId: number | undefined
let activePointerTarget: HTMLElement | undefined
let dragActivated = false
let suppressClick = false

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
    dragController.beginMaterialKeyboard(material.key, createDesignerNodeId('candidate'))
}

onBeforeUnmount(() => {
  dragController?.cancel()
  cleanupPointerDrag()
})

watch(() => props.readonly, (readonly) => {
  if (!readonly)
    return
  dragController?.cancel()
  cleanupPointerDrag()
  dragActivated = false
})
</script>

<template>
  <aside class="mx-config-form-designer__palette" :aria-label="locale.t('palette.materials', 'Materials')">
    <div class="mx-config-form-designer__search">
      <Search :size="16" aria-hidden="true" />
      <input v-model="query" type="search" :placeholder="locale.t('palette.search', 'Search')" :aria-label="locale.t('palette.searchMaterials', 'Search materials')">
    </div>
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
              type="button"
              class="mx-config-form-designer__palette-item-action"
              data-designer-draggable
              :data-material-key="material.key"
              :data-material-kind="material.kind"
              :disabled="readonly"
              :aria-label="locale.materialTitle(material)"
              :aria-pressed="isMaterialKeyboardDragging(material.key)"
              :title="locale.materialTitle(material)"
              @click.stop="addMaterial(material.key)"
              @keydown="handleMaterialKeydown(material, $event)"
              @pointerdown="prepareMaterialDrag(material, $event)"
            />
            <span class="mx-config-form-designer__palette-item-summary" aria-hidden="true">
              <component :is="material.icon" v-if="material.icon" :size="17" aria-hidden="true" />
              <span class="mx-config-form-designer__palette-icon" v-else aria-hidden="true">
                {{ material.kind === 'field' ? 'F' : 'L' }}
              </span>
              <span class="mx-config-form-designer__palette-item-name">{{ locale.materialTitle(material) }}</span>
            </span>
            <DesignerMaterialSpecimen
              v-if="registry"
              :form="form"
              :material="material"
              :registry="registry"
            />
          </div>
        </div>
      </section>
      <p v-if="groups.length === 0" class="mx-config-form-designer__empty-state">{{ locale.t('palette.empty', 'No materials') }}</p>
    </div>
  </aside>
</template>
