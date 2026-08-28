<script setup lang="ts">
import type { DesignerNode } from '../document'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../registry'
import { Search } from '@lucide/vue'
import Sortable from 'sortablejs'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useDesignerLocale } from '../locale'
import DesignerNodePreview from './DesignerNodePreview.vue'

const props = defineProps<{
  materials: DesignerMaterialDefinition[]
  registry?: DesignerRegistry
  readonly?: boolean
}>()
const locale = useDesignerLocale()

const emit = defineEmits<{
  addMaterial: [materialKey: string]
}>()

const query = ref('')
const listRef = ref<HTMLElement>()
const preparedPreviewMaterialKey = ref<string>()
const preparedPreviewMaterial = shallowRef<DesignerMaterialDefinition>()
const preparedPreviewNode = shallowRef<DesignerNode>()
const dragOverlayActive = ref(false)
const dragPointer = ref({ x: 0, y: 0 })
let sortables: Sortable[] = []
let dragStart: { x: number, y: number } | undefined

function setDragging(active: boolean): void {
  listRef.value?.closest<HTMLElement>('.mx-config-form-designer')?.classList.toggle('is-dragging', active)
}

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

function clearPreparedPreview(): void {
  window.removeEventListener('pointermove', handlePreviewPointerMove)
  window.removeEventListener('pointerup', clearPreparedPreview)
  window.removeEventListener('pointercancel', clearPreparedPreview)
  dragStart = undefined
  dragOverlayActive.value = false
  preparedPreviewMaterialKey.value = undefined
  preparedPreviewMaterial.value = undefined
  preparedPreviewNode.value = undefined
}

function handlePreviewPointerMove(event: PointerEvent): void {
  if (!dragStart)
    return
  const distance = Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y)
  if (distance < 4)
    return
  dragPointer.value = { x: event.clientX, y: event.clientY }
  dragOverlayActive.value = true
}

function prepareMaterialPreview(material: DesignerMaterialDefinition, event: PointerEvent): void {
  clearPreparedPreview()
  if (props.readonly)
    return
  preparedPreviewMaterialKey.value = material.key
  preparedPreviewMaterial.value = material
  dragStart = { x: event.clientX, y: event.clientY }
  dragPointer.value = { x: event.clientX, y: event.clientY }
  window.addEventListener('pointermove', handlePreviewPointerMove)
  window.addEventListener('pointerup', clearPreparedPreview, { once: true })
  window.addEventListener('pointercancel', clearPreparedPreview, { once: true })
  if (!props.registry)
    return
  const suffix = material.key.replace(/[^a-z0-9_-]+/gi, '-')
  try {
    preparedPreviewNode.value = props.registry.createNode(material.key, {
      id: `palette-preview-${suffix}`,
      ...(material.kind === 'field' ? { field: `preview_${suffix.replace(/-/g, '_')}` } : {}),
    })
  }
  catch {
    // A broken material remains usable from the palette and reports through the real add flow.
  }
}

function addMaterial(materialKey: string): void {
  if (!props.readonly) {
    emit('addMaterial', materialKey)
    clearPreparedPreview()
  }
}

function destroySortable(): void {
  setDragging(false)
  clearPreparedPreview()
  for (const sortable of sortables)
    sortable.destroy()
  sortables = []
}

async function createSortable(): Promise<void> {
  destroySortable()
  if (props.readonly)
    return
  await nextTick()
  if (!listRef.value || props.readonly)
    return
  const group = {
    name: 'config-form-designer',
    pull: 'clone' as const,
    put: false as const,
  }
  for (const list of listRef.value.querySelectorAll<HTMLElement>('.mx-config-form-designer__palette-items')) {
    sortables.push(Sortable.create(list, {
      animation: 180,
      draggable: '[data-designer-draggable]',
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      forceFallback: true,
      group,
      sort: false,
      onStart: () => setDragging(true),
      onEnd: () => {
        setDragging(false)
        clearPreparedPreview()
      },
    }))
  }
}

watch(() => props.readonly, createSortable)
watch(() => props.materials, createSortable)
onMounted(createSortable)
onBeforeUnmount(destroySortable)
</script>

<template>
  <aside class="mx-config-form-designer__palette" :aria-label="locale.t('palette.materials', 'Materials')">
    <div class="mx-config-form-designer__search">
      <Search :size="16" aria-hidden="true" />
      <input v-model="query" type="search" :placeholder="locale.t('palette.search', 'Search')" :aria-label="locale.t('palette.searchMaterials', 'Search materials')">
    </div>
    <div ref="listRef" class="mx-config-form-designer__palette-list">
      <section v-for="[category, entries] in groups" :key="category" class="mx-config-form-designer__palette-group">
        <h2>{{ category }}</h2>
        <div class="mx-config-form-designer__palette-items">
          <div
            v-for="material in entries"
            :key="material.key"
            class="mx-config-form-designer__palette-item"
            :class="{ 'has-drag-preview': preparedPreviewMaterialKey === material.key && preparedPreviewNode }"
            data-designer-draggable
            :data-material-key="material.key"
            role="button"
            :aria-disabled="readonly ? 'true' : undefined"
            :tabindex="readonly ? -1 : 0"
            :title="locale.materialTitle(material)"
            @click="addMaterial(material.key)"
            @keydown.enter.prevent="addMaterial(material.key)"
            @keydown.space.prevent="addMaterial(material.key)"
            @pointerdown="prepareMaterialPreview(material, $event)"
            @pointerup="clearPreparedPreview"
            @pointercancel="clearPreparedPreview"
          >
            <span class="mx-config-form-designer__palette-item-summary">
              <component :is="material.icon" v-if="material.icon" :size="17" aria-hidden="true" />
              <span class="mx-config-form-designer__palette-icon" v-else aria-hidden="true">
                {{ material.kind === 'field' ? 'F' : 'L' }}
              </span>
              <span>{{ locale.materialTitle(material) }}</span>
            </span>
            <span
              v-if="registry && preparedPreviewMaterialKey === material.key && preparedPreviewNode"
              class="mx-config-form-designer__palette-drag-preview"
              aria-hidden="true"
              inert
            >
              <DesignerNodePreview
                :node="preparedPreviewNode"
                :registry="registry"
              />
            </span>
          </div>
        </div>
      </section>
      <p v-if="groups.length === 0" class="mx-config-form-designer__empty-state">{{ locale.t('palette.empty', 'No materials') }}</p>
    </div>
  </aside>
  <Teleport to="body">
    <div
      v-if="dragOverlayActive && preparedPreviewMaterial"
      class="mx-config-form-designer__drag-overlay"
      :class="{ 'has-runtime-preview': preparedPreviewNode }"
      :style="{ left: `${dragPointer.x}px`, top: `${dragPointer.y}px` }"
      aria-hidden="true"
      inert
    >
      <DesignerNodePreview
        v-if="registry && preparedPreviewNode"
        :node="preparedPreviewNode"
        :registry="registry"
      />
      <span v-else class="mx-config-form-designer__drag-overlay-summary">
        <component :is="preparedPreviewMaterial.icon" v-if="preparedPreviewMaterial.icon" :size="17" aria-hidden="true" />
        <span class="mx-config-form-designer__palette-icon" v-else aria-hidden="true">
          {{ preparedPreviewMaterial.kind === 'field' ? 'F' : 'L' }}
        </span>
        <span>{{ locale.materialTitle(preparedPreviewMaterial) }}</span>
      </span>
    </div>
  </Teleport>
</template>
