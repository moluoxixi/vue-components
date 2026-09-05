<script setup lang="ts">
import type { DesignerPropertyPanelEmits, DesignerPropertyPanelProps } from './types'
import type { ConfigFormFlowTrigger } from '@moluoxixi/config-form-core'
import { ChevronRight, Trash2, Workflow } from '@lucide/vue'
import { computed } from 'vue'
import { getConfigFormFlowTriggerKey } from '@moluoxixi/config-form-core'
import { useDesignerLocale } from '../../locale'
import { DesignerPropertyForm, DesignerResponsiveSettings } from './components'
import { useDesignerPropertyEntries, useDesignerPropertyTabs } from './composables'

const props = defineProps<DesignerPropertyPanelProps>()
const emit = defineEmits<DesignerPropertyPanelEmits>()
const locale = useDesignerLocale()

const formFlowEvents = computed(() => [
  {
    label: locale.t('flow.trigger.mount', 'Form load'),
    code: 'page.mount',
    trigger: { kind: 'page.mount' } as ConfigFormFlowTrigger,
  },
  {
    label: locale.t('flow.trigger.submit', 'Form submit'),
    code: 'form.submit',
    trigger: { kind: 'form.submit' } as ConfigFormFlowTrigger,
  },
].map(event => ({
  ...event,
  flows: (props.flows ?? []).filter(flow => getConfigFormFlowTriggerKey(flow.trigger) === getConfigFormFlowTriggerKey(event.trigger)),
})))

function flowState(trigger: ConfigFormFlowTrigger): { count: number, nodes: number, duplicate: boolean } {
  const flows = (props.flows ?? []).filter(flow => getConfigFormFlowTriggerKey(flow.trigger) === getConfigFormFlowTriggerKey(trigger))
  return {
    count: flows.length,
    nodes: flows[0]?.nodes.length ?? 0,
    duplicate: flows.length > 1,
  }
}

function eventLabel(eventName: string): string {
  const binding = projection.value.commonBindings.find(candidate => candidate.trigger === eventName)
    ?? props.componentDefinition?.bindings.find(candidate => candidate.trigger === eventName)
  return binding ? locale.t('flow.trigger.valueChange', 'Value change') : resolveMaterialEventTitle(eventName)
}

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
            :aria-label="locale.t('property.eventFlow.openNamed', 'Configure {event} event flow', { event: eventLabel(event.name) })"
            @click="configureEvent(event.name)"
          >
            <Workflow :size="15" aria-hidden="true" />
            <span>
              <strong>{{ eventLabel(event.name) }}</strong>
              <code>{{ event.name }}</code>
            </span>
            <small v-if="flowState({ kind: 'component.event', nodeId: node.id, event: event.name }).duplicate" class="is-conflict">{{ locale.t('flow.status.conflict', 'Conflict') }}</small>
            <small v-else-if="flowState({ kind: 'component.event', nodeId: node.id, event: event.name }).count" class="is-configured">{{ locale.t('flow.status.configured', 'Configured · {nodes} nodes', { nodes: flowState({ kind: 'component.event', nodeId: node.id, event: event.name }).nodes }) }}</small>
            <small v-else class="is-unconfigured">{{ locale.t('flow.status.unconfigured', 'Not orchestrated') }}</small>
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
        <section class="mx-config-form-designer__form-events" :aria-label="locale.t('flow.formEvents', 'Form events')">
          <header><strong>{{ locale.t('flow.formEvents', 'Form events') }}</strong></header>
          <button
            v-for="event in formFlowEvents"
            :key="event.code"
            type="button"
            :disabled="readonly"
            :aria-label="locale.t('property.eventFlow.openNamed', 'Configure {event} event flow', { event: event.label })"
            @click="emit('configureFlow', event.trigger)"
          >
            <Workflow :size="15" aria-hidden="true" />
            <span><strong>{{ event.label }}</strong><code>{{ event.code }}</code></span>
            <small v-if="event.flows.length > 1" class="is-conflict">{{ locale.t('flow.status.conflict', 'Conflict') }}</small>
            <small v-else-if="event.flows.length" class="is-configured">{{ locale.t('flow.status.configured', 'Configured · {nodes} nodes', { nodes: event.flows[0]!.nodes.length }) }}</small>
            <small v-else class="is-unconfigured">{{ locale.t('flow.status.unconfigured', 'Not orchestrated') }}</small>
            <ChevronRight :size="15" aria-hidden="true" />
          </button>
        </section>
      </div>
    </template>

    <ul v-if="selectedDiagnostics.length" class="mx-config-form-designer__property-diagnostics" :aria-label="locale.t('property.diagnostics', 'Diagnostics')">
      <li v-for="(diagnostic, index) in selectedDiagnostics" :key="`${diagnostic.code}-${index}`">
        {{ diagnostic.message }}
      </li>
    </ul>
  </aside>
</template>
