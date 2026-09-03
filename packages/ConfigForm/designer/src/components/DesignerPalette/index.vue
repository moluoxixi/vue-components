<script setup lang="ts">
import type { FormSettings } from '@moluoxixi/config-form-model'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../../registry'
import type { DesignerPaletteMaterialBindings } from './types'
import { Search } from '@lucide/vue'
import { computed, inject, ref } from 'vue'
import { useDesignerLocale } from '../../locale'
import { DESIGNER_SESSION_KEY } from '../DesignerCanvas/services'
import { useDesignerPaletteDrag } from './composables'
import './style'

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
const query = ref('')
const { getMaterialBindings, isMaterialKeyboardDragging } = useDesignerPaletteDrag({
  dragController: designSession?.drag,
  materialTitle: locale.materialTitle,
  onAddMaterial: materialKey => emit('addMaterial', materialKey),
  readonly: () => props.readonly,
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
