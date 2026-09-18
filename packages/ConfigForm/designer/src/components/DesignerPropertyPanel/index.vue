<script setup lang="ts">
import type { DesignerPropertyPanelEmits, DesignerPropertyPanelProps } from './types'
import { useDesignerLocale } from '../../locale'
import { DesignerPropertyForm, DesignerResponsiveSettings } from './components'
import { useDesignerPropertyEntries, useDesignerPropertyTabs } from './composables'

const props = defineProps<DesignerPropertyPanelProps>()
const emit = defineEmits<DesignerPropertyPanelEmits>()
const locale = useDesignerLocale()

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

const {
  activeTab,
  handlePropertyTabKeydown,
  propertyPanelRef,
  propertyTabId,
  propertyTabPanelId,
  selectPropertyTab,
} = useDesignerPropertyTabs({
  identity: () => JSON.stringify({
    sections: propertyTabs.value.map(tab => [tab.id, tab.editable]),
    selection: selectedNodes.value.map(node => [node.id, node.component, node.kind]),
  }),
  tabs: () => propertyTabs.value,
})

defineExpose({ propertyPanelRef })
</script>

<template>
  <aside ref="propertyPanelRef" class="mx-config-form-designer__properties" :aria-label="locale.t('property.properties', 'Properties')">
    <template v-if="node">
      <div class="mx-config-form-designer__property-heading">
        <strong>{{ selectedNodes.length > 1 ? locale.t('property.selectedCount', '{count} selected', { count: selectedNodes.length }) : node.kind === 'field' ? (node.label || node.field) : primaryMaterial ? locale.materialTitle(primaryMaterial) : node.component }}</strong>
      </div>
      <div class="mx-config-form-designer__tabs" role="tablist" :aria-label="locale.t('property.views', 'Property views')">
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
          {{ tab.label }}
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
        <DesignerPropertyForm
          :entries="propertyEntries[tab.id]"
          :renderer="renderer"
          :components="components"
          :controls="propertyControls"
          :readonly="sectionReadonly(tab.id)"
          :node="node"
          @commit="commitNodePath"
        />
      </div>
    </template>

    <template v-else>
      <div class="mx-config-form-designer__property-heading">
        <strong>{{ locale.t('property.form', 'Form') }}</strong>
      </div>
      <div class="mx-config-form-designer__property-fields">
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
      </div>
    </template>

    <ul v-if="selectedDiagnostics.length" class="mx-config-form-designer__property-diagnostics" :aria-label="locale.t('property.diagnostics', 'Diagnostics')">
      <li v-for="(diagnostic, index) in selectedDiagnostics" :key="`${diagnostic.code}-${index}`">
        {{ diagnostic.message }}
      </li>
    </ul>
  </aside>
</template>
