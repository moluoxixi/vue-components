<script setup lang="ts">
import type { DesignerMaterialDefinition } from '../registry'
import { Search } from '@lucide/vue'
import Sortable from 'sortablejs'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDesignerLocale } from '../locale'

const props = defineProps<{
  materials: DesignerMaterialDefinition[]
  readonly?: boolean
}>()
const locale = useDesignerLocale()

const emit = defineEmits<{
  addMaterial: [materialKey: string]
}>()

const query = ref('')
const listRef = ref<HTMLElement>()
let sortables: Sortable[] = []

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

function destroySortable(): void {
  setDragging(false)
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
      animation: 120,
      draggable: '[data-designer-draggable]',
      forceFallback: true,
      group,
      sort: false,
      onStart: () => setDragging(true),
      onEnd: () => setDragging(false),
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
          <button
            v-for="material in entries"
            :key="material.key"
            type="button"
            class="mx-config-form-designer__palette-item"
            data-designer-draggable
            :data-material-key="material.key"
            :disabled="readonly"
            :title="locale.materialTitle(material)"
            @click="emit('addMaterial', material.key)"
          >
            <component :is="material.icon" v-if="material.icon" :size="17" aria-hidden="true" />
            <span class="mx-config-form-designer__palette-icon" v-else aria-hidden="true">
              {{ material.kind === 'field' ? 'F' : 'L' }}
            </span>
            <span>{{ locale.materialTitle(material) }}</span>
          </button>
        </div>
      </section>
      <p v-if="groups.length === 0" class="mx-config-form-designer__empty-state">{{ locale.t('palette.empty', 'No materials') }}</p>
    </div>
  </aside>
</template>
