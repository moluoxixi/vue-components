<script setup lang="ts">
import type { DesignerPropertyPanelEmits, DesignerPropertyPanelProps } from './types'
import { ChevronRight, Trash2, Workflow } from '@lucide/vue'
import { useDesignerLocale } from '../../locale'
import { DesignerPropertyForm, DesignerResponsiveSettings } from './components'
import { useDesignerPropertyEntries, useDesignerPropertyTabs } from './composables'
import './style'

const props = defineProps<DesignerPropertyPanelProps>()
const emit = defineEmits<DesignerPropertyPanelEmits>()
const locale = useDesignerLocale()

const {
  commitBinding,
  commitForm,
  commitNodePath,
  configureEvent,
  fieldOptions,
  formEntries,
  formatStaleValue,
  primaryMaterial,
  projection,
  propertyEntries,
  propertyTabs,
  reactionIds,
  removeStaleItem,
  resolveMaterialEventTitle,
  sectionReadonly,
  selectedDiagnostics,
  selectedNodes,
  staleItemsFor,
  staleKindLabel,
  staleNodeLabel,
  staleReason,
} = useDesignerPropertyEntries(props, {
  onConfigureEvent: target => emit('configureEvent', target),
  onRemoveStoredConfig: (nodeId, path) => emit('removeStoredConfig', nodeId, path),
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
        <ul
          v-if="staleItemsFor(tab.id).length"
          class="mx-config-form-designer__stale-configs"
          :aria-label="locale.t('property.stale.configuration', 'Stored configuration warnings')"
        >
          <li
            v-for="item in staleItemsFor(tab.id)"
            :key="`${item.nodeId}-${item.kind}-${item.key}`"
            :data-stale-kind="item.kind"
            :data-stale-node-id="item.nodeId"
          >
            <div class="mx-config-form-designer__stale-heading">
              <strong>{{ staleKindLabel(item) }}</strong>
              <div class="mx-config-form-designer__stale-actions">
                <code>{{ item.key }}</code>
                <button
                  v-if="item.removal"
                  type="button"
                  class="mx-config-form-designer__icon-button is-danger"
                  data-stale-remove
                  :aria-label="locale.t('property.stale.delete', 'Delete stored configuration {key} from {node}', { key: item.key, node: staleNodeLabel(item) })"
                  :title="locale.t('property.stale.delete', 'Delete stored configuration {key} from {node}', { key: item.key, node: staleNodeLabel(item) })"
                  :disabled="readonly"
                  @click="removeStaleItem(item)"
                >
                  <Trash2 :size="14" aria-hidden="true" />
                </button>
              </div>
            </div>
            <span>{{ staleNodeLabel(item) }} · {{ staleReason(item) }}</span>
            <pre>{{ formatStaleValue(item.value) }}</pre>
          </li>
        </ul>

        <div v-if="tab.id === 'events'" class="mx-config-form-designer__event-flows">
          <button
            v-for="event in projection.commonEvents"
            :key="event.name"
            type="button"
            :disabled="sectionReadonly(tab.id)"
            :aria-label="locale.t('property.eventFlow.openNamed', 'Configure {event} event flow', { event: resolveMaterialEventTitle(event.name) })"
            @click="configureEvent(event.name)"
          >
            <Workflow :size="15" aria-hidden="true" />
            <span>
              <strong>{{ resolveMaterialEventTitle(event.name) }}</strong>
              <code>{{ event.name }}</code>
            </span>
            <ChevronRight :size="15" aria-hidden="true" />
          </button>
        </div>
        <DesignerPropertyForm
          v-else-if="tab.id === 'bindings'"
          :entries="propertyEntries.bindings"
          :components="components"
          :controls="propertyControls"
          :readonly="sectionReadonly(tab.id)"
          @commit="commitBinding"
        />
        <DesignerPropertyForm
          v-else
          :entries="propertyEntries[tab.id]"
          :components="components"
          :controls="propertyControls"
          :readonly="sectionReadonly(tab.id)"
          :node="node"
          :field-options="fieldOptions"
          :reaction-ids="reactionIds"
          :validator-options="validatorOptions"
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
