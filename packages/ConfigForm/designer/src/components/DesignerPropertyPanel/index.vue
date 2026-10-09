<script setup lang="ts">
import type { DesignerPropertyPanelEmits, DesignerPropertyPanelProps } from './types'
import { ChevronRight, Layers3, PanelsTopLeft, Search, SlidersHorizontal, X } from '@lucide/vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useDesignerLocale } from '../../locale'
import {
  DesignerDataBindingEditor,
  DesignerInteractionEditor,
  DesignerPropertyForm,
  DesignerResponsiveSettings,
} from './components'
import DesignerValidationLab from './components/DesignerValidationLab.vue'
import { useDesignerPropertyEntries, useDesignerPropertyTabs } from './composables'

const props = defineProps<DesignerPropertyPanelProps>()
const emit = defineEmits<DesignerPropertyPanelEmits>()
const locale = useDesignerLocale()
const propertyQuery = ref('')
type PropertyGroupId = 'essentials' | 'layout' | 'appearance' | 'data' | 'guidance' | 'advanced'
const collapsedPropertyGroups = ref(new Set<PropertyGroupId>())

const {
  commitForm,
  commitNodePath,
  formEntries,
  primaryMaterial,
  propertyEntries,
  propertyTabs,
  sectionReadonly,
  selectedDiagnostics,
  selectedNodes,
} = useDesignerPropertyEntries(props, {
  onUpdateForm: changes => emit('updateForm', changes),
  onUpdatePath: (nodeId, path, value) => emit('updatePath', nodeId, path, value),
  onUpdatePaths: (nodeIds, path, value) => emit('updatePaths', nodeIds, path, value),
})

const { activeTab, handlePropertyTabKeydown, propertyPanelRef, propertyTabId, propertyTabPanelId, selectPropertyTab }
  = useDesignerPropertyTabs({
    identity: () => JSON.stringify({
      sections: propertyTabs.value.map(tab => [tab.id, tab.editable]),
      selection: selectedNodes.value.map(node => [node.id, node.component, node.kind]),
    }),
    tabs: () => propertyTabs.value,
  })

const selectionTitle = computed(() => selectedNodes.value.length > 1
  ? locale.t('property.selectedCount', '{count} selected', { count: selectedNodes.value.length })
  : selectedNodes.value[0]
    ? selectedNodes.value[0].kind === 'field'
      ? selectedNodes.value[0].label || selectedNodes.value[0].field
      : primaryMaterial.value
        ? locale.materialTitle(primaryMaterial.value)
        : selectedNodes.value[0].component
    : locale.t('property.form', 'Form'),
)
const selectionKind = computed(() => selectedNodes.value.length > 1
  ? locale.t('property.multipleSelection', 'Multiple selection')
  : primaryMaterial.value
    ? locale.materialCategory(primaryMaterial.value)
    : locale.t('property.form', 'Form'),
)
const selectionContext = computed(() => {
  const selected = selectedNodes.value[0]
  if (selectedNodes.value.length > 1)
    return locale.t('property.sharedProperties', 'Editing shared properties')
  if (!selected)
    return locale.t('property.formScope', 'Form-level settings')
  const title = primaryMaterial.value ? locale.materialTitle(primaryMaterial.value) : selected.component
  return selected.kind === 'field'
    ? `${title} · ${selected.field}`
    : `${locale.t('property.componentScope', 'Component')} · ${selected.component}`
})
function propertyGroupId(entry: (typeof propertyEntries.value.properties)[number]): PropertyGroupId {
  const path = entry.setter.path.join('.')
  if (/^(?:description|help|warning)$/.test(path))
    return 'guidance'
  if (/^(?:field|label)$/.test(path) || /\.(?:placeholder|disabled|readonly)$/.test(path))
    return 'essentials'
  if (path === 'span' || /\.(?:width|height|align|direction|gap|columns|labelWidth)$/.test(path))
    return 'layout'
  if (path === 'defaultValue' || /\.(?:options|multiple|clearable|filterable|data|items)$/.test(path))
    return 'data'
  if (/\.(?:size|type|color|border|round|plain|shadow|showLabel|label)$/.test(path))
    return 'appearance'
  return 'advanced'
}

function propertyGroupLabel(id: PropertyGroupId): string {
  const labels = {
    essentials: 'Essentials',
    layout: 'Layout',
    appearance: 'Appearance',
    data: 'Data',
    guidance: 'Supporting text',
    advanced: 'Advanced',
  }
  return locale.t(`property.group.${id}`, labels[id])
}

const visiblePropertyEntries = computed(() => {
  const query = propertyQuery.value.trim().toLocaleLowerCase()
  const entries = propertyEntries.value.properties
  if (!query)
    return entries
  return entries.filter((entry) => {
    const { setter, hint } = entry
    return [setter.label, setter.key, ...setter.path, hint ?? '', propertyGroupLabel(propertyGroupId(entry))]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query)
  })
})
const propertyGroups = computed(() => {
  const entriesByGroup = new Map<PropertyGroupId, typeof visiblePropertyEntries.value>()
  for (const entry of visiblePropertyEntries.value) {
    const id = propertyGroupId(entry)
    const entries = entriesByGroup.get(id) ?? []
    entries.push(entry)
    entriesByGroup.set(id, entries)
  }
  return (['essentials', 'layout', 'appearance', 'data', 'guidance', 'advanced'] as const)
    .filter(id => entriesByGroup.has(id))
    .map(id => ({
      id,
      label: propertyGroupLabel(id),
      entries: entriesByGroup.get(id)!,
    }))
})
const showPropertySearch = computed(
  () => activeTab.value === 'properties' && propertyEntries.value.properties.length >= 5,
)
const hasPropertyQuery = computed(() => propertyQuery.value.trim().length > 0)

watch(
  () => selectedNodes.value.map(node => node.id).join('\u0000'),
  () => {
    propertyQuery.value = ''
    const hasGuidance = propertyEntries.value.properties.some(entry =>
      propertyGroupId(entry) === 'guidance' && typeof entry.value === 'string' && entry.value.trim(),
    )
    collapsedPropertyGroups.value = new Set<PropertyGroupId>(hasGuidance ? ['advanced'] : ['guidance', 'advanced'])
    selectPropertyTab('properties')
  },
  { immediate: true },
)
watch(activeTab, (tab) => {
  if (tab !== 'properties')
    propertyQuery.value = ''
})

function clearPropertyQuery(): void {
  propertyQuery.value = ''
  void nextTick(() => propertyPanelRef.value?.querySelector<HTMLInputElement>('[data-property-search]')?.focus())
}

function isPropertyGroupCollapsed(id: PropertyGroupId): boolean {
  return !hasPropertyQuery.value && collapsedPropertyGroups.value.has(id)
}

function togglePropertyGroup(id: PropertyGroupId): void {
  const next = new Set(collapsedPropertyGroups.value)
  if (next.has(id))
    next.delete(id)
  else
    next.add(id)
  collapsedPropertyGroups.value = next
}

function updateDatasetBinding(
  bindingKey: string,
  reference: DesignerPropertyPanelEmits['updateDatasetBinding'][2],
): void {
  if (props.node)
    emit('updateDatasetBinding', props.node.id, bindingKey, reference)
}

function updateResourceBinding(bindingKey: string, resourceId: string | undefined): void {
  if (props.node)
    emit('updateResourceBinding', props.node.id, bindingKey, resourceId)
}

function saveOptionsAsDataset(bindingKey: string, name: string): void {
  if (props.node)
    emit('saveOptionsAsDataset', props.node.id, bindingKey, name)
}

function materializeOptionsSnapshot(bindingKey: string): void {
  if (props.node)
    emit('materializeOptionsSnapshot', props.node.id, bindingKey)
}

defineExpose({ propertyPanelRef })
</script>

<template>
  <aside
    ref="propertyPanelRef"
    class="mx-config-form-designer__properties"
    :aria-label="locale.t('property.properties', 'Properties')"
  >
    <header class="mx-config-form-designer__property-heading">
      <span
        class="mx-config-form-designer__property-mark"
        :data-node-kind="selectedNodes[0]?.kind ?? 'form'"
        aria-hidden="true"
      >
        <component
          :is="
            selectedNodes.length > 1
              ? Layers3
              : selectedNodes.length === 0
                ? PanelsTopLeft
                : (primaryMaterial?.icon ?? SlidersHorizontal)
          "
          :size="16"
        />
      </span>
      <span class="mx-config-form-designer__property-identity">
        <strong :title="selectionTitle">{{ selectionTitle }}</strong>
        <span :title="selectionContext">{{ selectionContext }}</span>
      </span>
      <span v-if="selectedNodes.length" class="mx-config-form-designer__selection-kind">{{ selectionKind }}</span>
    </header>
    <div
      class="mx-config-form-designer__tabs"
      role="tablist"
      :aria-label="locale.t('property.views', 'Property views')"
    >
      <button
        v-for="tab in propertyTabs"
        :id="propertyTabId(tab.id)"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-controls="propertyTabPanelId(tab.id)"
        :aria-selected="activeTab === tab.id"
        :data-property-tab="tab.id"
        :tabindex="activeTab === tab.id ? 0 : -1"
        @click="selectPropertyTab(tab.id)"
        @keydown="handlePropertyTabKeydown($event, tab.id)"
      >
        <span>{{ tab.label }}</span>
        <span
          v-if="tab.id === 'properties' && selectedNodes.length"
          class="mx-config-form-designer__tab-count"
          :data-count="propertyEntries.properties.length"
          aria-hidden="true"
        />
      </button>
    </div>

    <div v-if="showPropertySearch" class="mx-config-form-designer__property-search" role="search">
      <Search :size="14" aria-hidden="true" />
      <input
        v-model="propertyQuery"
        type="text"
        :aria-label="locale.t('property.searchProperties', 'Search properties')"
        :placeholder="locale.t('property.searchPlaceholder', 'Search settings…')"
        data-property-search
      >
      <output v-if="hasPropertyQuery" class="mx-config-form-designer__search-count" aria-live="polite">
        {{
          locale.t('property.searchResultCount', '{visible} / {total}', {
            visible: visiblePropertyEntries.length,
            total: propertyEntries.properties.length,
          })
        }}
      </output>
      <button
        v-if="hasPropertyQuery"
        type="button"
        class="mx-config-form-designer__search-clear"
        :aria-label="locale.t('property.clearSearch', 'Clear property search')"
        @click="clearPropertyQuery"
      >
        <X :size="13" aria-hidden="true" />
      </button>
    </div>

    <div
      v-for="tab in propertyTabs"
      :id="propertyTabPanelId(tab.id)"
      :key="tab.id"
      class="mx-config-form-designer__property-fields"
      :data-property-panel="tab.id"
      role="tabpanel"
      :aria-labelledby="propertyTabId(tab.id)"
      :hidden="activeTab !== tab.id"
      :inert="activeTab !== tab.id ? true : undefined"
      :tabindex="activeTab === tab.id ? 0 : -1"
    >
      <DesignerInteractionEditor
        v-if="tab.id === 'interactions'"
        :component-definition="componentDefinition"
        :get-component-definition="getComponentDefinition"
        :graph="graph"
        :interactions="interactions"
        :node="node"
        :readonly="node ? sectionReadonly(tab.id) : readonly"
        :surface-id="surfaceId"
        :surfaces="surfaces"
        @update="emit('updateInteractions', $event)"
      />
      <template v-else-if="node">
        <DesignerPropertyForm
          v-if="tab.id === 'validation' && propertyEntries.validation.length > 0"
          :entries="propertyEntries.validation"
          :renderer="renderer"
          :components="components"
          :controls="propertyControls"
          :readonly="sectionReadonly(tab.id)"
          :node="node"
          @commit="commitNodePath"
        />
        <template v-if="tab.id === 'properties'">
          <section
            v-for="group in propertyGroups"
            :key="group.id"
            class="mx-config-form-designer__property-group"
            :data-property-group="group.id"
          >
            <button
              :id="`${propertyTabPanelId('properties')}-group-${group.id}-trigger`"
              type="button"
              class="mx-config-form-designer__property-group-trigger"
              :aria-controls="`${propertyTabPanelId('properties')}-group-${group.id}-content`"
              :aria-expanded="!isPropertyGroupCollapsed(group.id)"
              :disabled="hasPropertyQuery"
              @click="togglePropertyGroup(group.id)"
            >
              <ChevronRight :size="14" aria-hidden="true" />
              <span>{{ group.label }}</span>
              <span class="mx-config-form-designer__property-group-count" aria-hidden="true">{{
                group.entries.length
              }}</span>
            </button>
            <div
              v-show="!isPropertyGroupCollapsed(group.id)"
              :id="`${propertyTabPanelId('properties')}-group-${group.id}-content`"
              class="mx-config-form-designer__property-group-content"
              :aria-labelledby="`${propertyTabPanelId('properties')}-group-${group.id}-trigger`"
              role="group"
            >
              <DesignerPropertyForm
                :entries="group.entries"
                :renderer="renderer"
                :components="components"
                :controls="propertyControls"
                :readonly="sectionReadonly(tab.id)"
                :node="node"
                @commit="commitNodePath"
              />
            </div>
          </section>
        </template>
        <div
          v-if="tab.id === 'properties' && hasPropertyQuery && propertyGroups.length === 0"
          class="mx-config-form-designer__property-empty"
          data-property-empty
          role="status"
        >
          <Search :size="15" aria-hidden="true" />
          <span>{{ locale.t('property.emptySearch', 'No properties match this search.') }}</span>
          <button type="button" @click="clearPropertyQuery">
            {{ locale.t('property.clearSearch', 'Clear search') }}
          </button>
        </div>
        <DesignerDataBindingEditor
          v-if="tab.id === 'properties' && selectedNodes.length === 1"
          :component-definition="componentDefinition"
          :datasets="datasets"
          :node="node"
          :readonly="sectionReadonly(tab.id)"
          :resources="resources"
          @materialize-options="materializeOptionsSnapshot"
          @save-options="saveOptionsAsDataset"
          @update-dataset="updateDatasetBinding"
          @update-resource="updateResourceBinding"
        />
        <DesignerValidationLab
          v-if="tab.id === 'validation' && selectedNodes.length === 1 && node?.kind === 'field'"
          :node="node"
        />
      </template>
      <template v-else>
        <DesignerPropertyForm
          :entries="formEntries"
          :renderer="renderer"
          :components="components"
          :controls="propertyControls"
          :readonly="readonly"
          @commit="commitForm"
        />
        <DesignerResponsiveSettings
          :form="graph.form"
          :components="components"
          :controls="propertyControls"
          :readonly="readonly"
          :renderer="renderer"
          @update-form="emit('updateForm', $event)"
        />
      </template>
    </div>

    <ul
      v-if="selectedDiagnostics.length"
      class="mx-config-form-designer__property-diagnostics"
      :aria-label="locale.t('property.diagnostics', 'Diagnostics')"
    >
      <li v-for="(diagnostic, index) in selectedDiagnostics" :key="`${diagnostic.code}-${index}`">
        {{ diagnostic.message }}
      </li>
    </ul>
  </aside>
</template>
