<script setup lang="ts">
import type { ConfigFormNode } from '@moluoxixi/config-form-headless'
import type { DesignerPropertyFormLayout, DesignerPropertyPanelEmits, DesignerPropertyPanelProps } from './types'
import { ChevronRight, Layers3, PanelsTopLeft, Search, SlidersHorizontal, X } from '@lucide/vue'
import { computed, h, markRaw, nextTick, ref, watch } from 'vue'
import { isVisualStyleEditable, VISUAL_STYLE_GROUPS } from '../../inspector'
import { useDesignerLocale } from '../../locale'
import {
  DesignerDataBindingEditor,
  DesignerInteractionEditor,
  DesignerPropertyForm,
} from './components'
import DesignerValidationLab from './components/DesignerValidationLab.vue'
import { useDesignerPropertyEntries, useDesignerPropertyTabs, useDesignerResponsiveSettings, useDesignerVisualStyleEntries } from './composables'

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
const selectionIdentity = computed(() => JSON.stringify([
  props.surfaceId,
  selectedNodes.value.map(node => [node.id, node.component, node.kind]),
]))

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
const visualPropertyFields = computed(() => selectedNodes.value.length > 0 && selectedNodes.value.every(isVisualStyleEditable)
  ? VISUAL_STYLE_GROUPS.flatMap(group => group.fields.map(field => ({
      label: locale.t(`visual.${field.key}`, field.label),
      group: locale.t(`visual.group.${group.key}`, group.label),
    })))
  : [],
)
const visibleVisualPropertyCount = computed(() => {
  const query = propertyQuery.value.trim().toLocaleLowerCase()
  return visualPropertyFields.value.filter(field => !query || [field.label, field.group, locale.t('visual.title', 'Design')]
    .some(label => label.toLocaleLowerCase().includes(query))).length
})
const totalPropertyCount = computed(() => propertyEntries.value.properties.length + visualPropertyFields.value.length)
const showPropertySearch = computed(
  () => activeTab.value === 'properties' && totalPropertyCount.value >= 5,
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

function updateVisualStyle(key: string, value: string | undefined): void {
  commitNodePath(value, { key, label: key, path: ['props', 'style', key], control: 'text' })
}

function commitInspectorProperty(...args: Parameters<typeof commitNodePath>): void {
  if (props.node)
    commitNodePath(...args)
  else
    commitForm(...args)
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

const visual = useDesignerVisualStyleEntries({
  nodes: () => selectedNodes.value,
  readonly: () => sectionReadonly('properties'),
  query: () => propertyQuery.value,
  update: updateVisualStyle,
})
const responsive = useDesignerResponsiveSettings(
  () => ({ form: props.graph.form, breakpoint: props.breakpoint, readonly: props.readonly }),
  { onUpdateForm: changes => emit('updateForm', changes) },
)
// Keep the complete draft model when search or tabs change the visible layout.
const inspectorEntries = computed(() => props.node
  ? [...propertyEntries.value.properties, ...propertyEntries.value.validation, ...visual.entries.value]
  : [...formEntries.value, ...responsive.entries.value])

const inspectorLayout: DesignerPropertyFormLayout = field => propertyTabs.value.map((tab) => {
  const content: ConfigFormNode[] = []
  if (tab.id === 'interactions') {
    content.push({
      id: 'interaction-editor',
      component: markRaw(DesignerInteractionEditor),
      props: {
        key: `${selectionIdentity.value}:interaction-editor`,
        componentDefinition: props.componentDefinition,
        getComponentDefinition: props.getComponentDefinition,
        graph: props.graph,
        interactions: props.interactions,
        node: props.node,
        readonly: props.node ? sectionReadonly(tab.id) : props.readonly,
        surfaceId: props.surfaceId,
        surfaces: props.surfaces,
        onUpdate: (value: DesignerPropertyPanelEmits['updateInteractions'][0]) => emit('updateInteractions', value),
      },
    })
  }
  else if (!props.node) {
    content.push({
      id: 'form-properties',
      component: 'div',
      props: { class: 'mx-config-form-designer__property-grid' },
      slots: { default: formEntries.value.map(field) },
    }, ...responsive.layout(field))
  }
  else if (tab.id === 'validation') {
    content.push({
      id: 'validation-properties',
      component: 'div',
      props: { class: 'mx-config-form-designer__property-grid' },
      slots: { default: propertyEntries.value.validation.map(field) },
    })
    if (selectedNodes.value.length === 1 && props.node.kind === 'field') {
      content.push({ id: 'validation-lab', component: markRaw(DesignerValidationLab), props: { node: props.node } })
    }
  }
  else {
    content.push(...visual.layout(field))
    for (const group of propertyGroups.value) {
      const groupId = `${propertyTabPanelId('properties')}-group-${group.id}`
      content.push({
        id: `property-group-${group.id}`,
        component: 'section',
        props: { 'class': 'mx-config-form-designer__property-group', 'data-property-group': group.id },
        slots: { default: [
          {
            id: `${groupId}-trigger`,
            component: 'button',
            props: {
              'id': `${groupId}-trigger`,
              'type': 'button',
              'class': 'mx-config-form-designer__property-group-trigger',
              'aria-controls': `${groupId}-content`,
              'aria-expanded': !isPropertyGroupCollapsed(group.id),
              'disabled': hasPropertyQuery.value,
              'onClick': () => togglePropertyGroup(group.id),
            },
            slots: { default: () => [
              h(ChevronRight, { size: 14, 'aria-hidden': true }),
              h('span', group.label),
              h('span', { class: 'mx-config-form-designer__property-group-count', 'aria-hidden': true }, group.entries.length),
            ] },
          },
          {
            id: `${groupId}-content`,
            component: 'div',
            props: {
              'id': `${groupId}-content`,
              'class': 'mx-config-form-designer__property-group-content mx-config-form-designer__property-grid',
              'style': isPropertyGroupCollapsed(group.id) ? { display: 'none' } : undefined,
              'aria-labelledby': `${groupId}-trigger`,
              'role': 'group',
            },
            slots: { default: group.entries.map(field) },
          },
        ] },
      })
    }
    if (hasPropertyQuery.value && propertyGroups.value.length === 0 && visibleVisualPropertyCount.value === 0) {
      content.push({
        id: 'empty-property-search',
        component: 'div',
        props: { 'class': 'mx-config-form-designer__property-empty', 'data-property-empty': '', 'role': 'status' },
        slots: { default: () => [
          h(Search, { size: 15, 'aria-hidden': true }),
          h('span', locale.t('property.emptySearch', 'No properties match this search.')),
          h('button', { type: 'button', onClick: clearPropertyQuery }, locale.t('property.clearSearch', 'Clear search')),
        ] },
      })
    }
    if (selectedNodes.value.length === 1) {
      content.push({
        id: 'data-binding-editor',
        component: markRaw(DesignerDataBindingEditor),
        props: {
          key: `${selectionIdentity.value}:data-binding-editor`,
          componentDefinition: props.componentDefinition,
          datasets: props.datasets,
          node: props.node,
          readonly: sectionReadonly(tab.id),
          resources: props.resources,
          onMaterializeOptions: materializeOptionsSnapshot,
          onSaveOptions: saveOptionsAsDataset,
          onUpdateDataset: updateDatasetBinding,
          onUpdateResource: updateResourceBinding,
        },
      })
    }
  }
  return {
    id: `inspector-panel-${tab.id}`,
    component: 'div',
    props: {
      'id': propertyTabPanelId(tab.id),
      'class': 'mx-config-form-designer__property-fields',
      'data-property-panel': tab.id,
      'role': 'tabpanel',
      'aria-labelledby': propertyTabId(tab.id),
      'hidden': activeTab.value !== tab.id,
      'inert': activeTab.value !== tab.id ? true : undefined,
      'tabindex': activeTab.value === tab.id ? 0 : -1,
    },
    slots: { default: content },
  }
})

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
          :data-count="totalPropertyCount"
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
            visible: visiblePropertyEntries.length + visibleVisualPropertyCount,
            total: totalPropertyCount,
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

    <DesignerPropertyForm
      class="mx-config-form-designer__inspector-form"
      :entries="inspectorEntries"
      :layout="inspectorLayout"
      :renderer="renderer"
      :components="components"
      :controls="propertyControls"
      :readonly="readonly"
      :node="node"
      :identity="selectionIdentity"
      gap="0"
      @commit="commitInspectorProperty"
    />
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
