<script setup lang="ts">
import type { DesignerMaterialDefinition } from '../registry'
import { Search } from '@lucide/vue'
import Sortable from 'sortablejs'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  materials: DesignerMaterialDefinition[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  addMaterial: [materialKey: string]
}>()

const query = ref('')
const listRef = ref<HTMLElement>()
let sortables: Sortable[] = []

const groups = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  const matched = normalized
    ? props.materials.filter(material => `${material.title} ${material.category}`.toLowerCase().includes(normalized))
    : props.materials
  const grouped = new Map<string, DesignerMaterialDefinition[]>()
  for (const material of matched) {
    const entries = grouped.get(material.category) ?? []
    entries.push(material)
    grouped.set(material.category, entries)
  }
  return [...grouped.entries()]
})

function destroySortable(): void {
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
    }))
  }
}

watch(() => props.readonly, createSortable)
watch(() => props.materials, createSortable)
onMounted(createSortable)
onBeforeUnmount(destroySortable)
</script>

<template>
  <aside class="mx-config-form-designer__palette" aria-label="Materials">
    <div class="mx-config-form-designer__search">
      <Search :size="16" aria-hidden="true" />
      <input v-model="query" type="search" placeholder="Search" aria-label="Search materials">
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
            :title="material.title"
            @click="emit('addMaterial', material.key)"
          >
            <component :is="material.icon" v-if="material.icon" :size="17" aria-hidden="true" />
            <span class="mx-config-form-designer__palette-icon" v-else aria-hidden="true">
              {{ material.kind === 'field' ? 'F' : 'L' }}
            </span>
            <span>{{ material.title }}</span>
          </button>
        </div>
      </section>
      <p v-if="groups.length === 0" class="mx-config-form-designer__empty-state">No materials</p>
    </div>
  </aside>
</template>
