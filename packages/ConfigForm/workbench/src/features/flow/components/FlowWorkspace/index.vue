<script setup lang="ts">
import type { ConfigFormFlowNode } from '@moluoxixi/config-form-core'
import type { FlowWorkspaceEmits, FlowWorkspaceProps } from './types'
import {
  CircleStop,
  GitBranch,
  Play,
  Plus,
  Trash2,
  Zap,
} from '@lucide/vue'
import { Handle, Position, VueFlow } from '@vue-flow/core'
import { flowEventTargetKey } from '../../../../flow'
import { useFlowWorkspace } from './composables'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const props = defineProps<FlowWorkspaceProps>()
const emit = defineEmits<FlowWorkspaceEmits>()
const {
  addFlow,
  addNode,
  commitNodeConfig,
  flowCreatorOpen,
  flowTriggerLabel,
  graphEdges,
  graphError,
  graphNodes,
  handleConnect,
  handleEdgesChange,
  handleNodesChange,
  initialTriggerKey,
  isNodeDeletable,
  isValidConnection,
  locale,
  nodeConfigDraft,
  openFlowCreator,
  patchSelected,
  patchSelectedNode,
  removeFlow,
  removeNode,
  selectedEventTarget,
  selectedEventTargetValue,
  selectedFlow,
  selectedId,
  selectedNode,
  selectedNodeId,
  triggerGroups,
  updateConcurrency,
  updateErrorPolicy,
  updateTimeout,
  updateTrigger,
  updateTriggerEvent,
  updateTriggerField,
} = useFlowWorkspace({ emit, props })

function nodeIcon(node: ConfigFormFlowNode) {
  if (node.type === 'trigger')
    return Play
  if (node.type === 'condition')
    return GitBranch
  if (node.type === 'end' || node.type === 'success' || node.type === 'failure')
    return CircleStop
  return Zap
}
</script>

<template>
  <section class="flow-workspace" :aria-label="locale.t('flow.workspace', 'Event flow workspace')">
    <header class="flow-workspace-header">
      <div>
        <strong>{{ locale.t('flow.title', 'Event flows') }}</strong>
        <small v-if="selectedFlow">{{ locale.t('flow.summary', '{nodes} nodes · {edges} edges', { nodes: selectedFlow.nodes.length, edges: selectedFlow.edges.length }) }}</small>
      </div>
      <ElDropdown
        ref="flowCreator"
        class="flow-create-control"
        trigger="click"
        placement="bottom-end"
        :disabled="readonly"
        :show-timeout="0"
        :hide-timeout="0"
        :hide-on-click="true"
        append-to="#workbench-overlays"
        popper-class="flow-trigger-popper"
        @command="addFlow"
        @visible-change="flowCreatorOpen = $event"
      >
        <ElButton
          ref="addFlowButton"
          native-type="button"
          :disabled="readonly"
          data-testid="add-flow"
          :title="locale.t('flow.add', 'Add event flow')"
        >
          <Plus :size="14" aria-hidden="true" />
          <span>{{ locale.t('flow.add', 'Add event flow') }}</span>
        </ElButton>
        <template #dropdown>
          <ElDropdownMenu class="flow-trigger-menu" :aria-label="locale.t('flow.chooseEvent', 'Choose event source')">
            <template v-for="group in triggerGroups" :key="group.group">
              <li class="flow-trigger-group-label" role="presentation">{{ group.label }}</li>
              <ElDropdownItem
                v-for="choice in group.choices"
                :key="choice.key"
                :command="choice.trigger"
                :class="{ 'is-preferred': initialTriggerKey === choice.key }"
                :data-trigger-key="choice.key"
              >
                <Play :size="13" aria-hidden="true" />
                <span>
                  <b>{{ choice.label }}</b>
                  <code>{{ choice.detail }}</code>
                </span>
              </ElDropdownItem>
            </template>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </header>

    <div v-if="flows.length" class="flow-workspace-body">
      <nav class="flow-list" :aria-label="locale.t('flow.list', 'Event flows')">
        <div v-for="flow in flows" :key="flow.id" class="flow-list-item" :class="{ 'is-active': selectedId === flow.id }">
          <button type="button" @click="selectedId = flow.id">
            <span>{{ flow.name }}</span>
            <small>{{ flowTriggerLabel(flow.trigger) }}</small>
          </button>
          <button type="button" :disabled="readonly" :title="locale.t('flow.delete', 'Delete flow')" :aria-label="locale.t('flow.delete', 'Delete flow')" @click="removeFlow(flow.id)">
            <Trash2 :size="13" aria-hidden="true" />
          </button>
        </div>
      </nav>

      <div v-if="selectedFlow" class="flow-editor">
        <div class="flow-editor-toolbar">
          <div class="flow-editor-title">
            <strong>{{ selectedFlow.name }}</strong>
            <code>{{ flowTriggerLabel(selectedFlow.trigger) }}</code>
          </div>
          <div class="flow-node-palette" role="toolbar" :aria-label="locale.t('flow.addNode', 'Add flow node')">
            <button type="button" :disabled="readonly" data-testid="add-condition" @click="addNode('condition')">
              <GitBranch :size="14" aria-hidden="true" />{{ locale.t('flow.condition', 'Condition') }}
            </button>
            <button type="button" :disabled="readonly" data-testid="add-reaction" @click="addNode('reaction')">
              <Zap :size="14" aria-hidden="true" />{{ locale.t('flow.reaction', 'Update form state') }}
            </button>
            <button type="button" :disabled="readonly" data-testid="add-action" @click="addNode('action')">
              <Plus :size="14" aria-hidden="true" />{{ locale.t('flow.action', 'Action') }}
            </button>
          </div>
        </div>

        <div class="flow-graph-shell" :aria-label="locale.t('flow.graph', '{name} graph', { name: selectedFlow.name })">
          <VueFlow
            :id="`flow-${selectedFlow.id}`"
            class="flow-graph"
            :nodes="graphNodes"
            :edges="graphEdges"
            :apply-default="false"
            :nodes-draggable="!readonly"
            :nodes-connectable="!readonly"
            :elements-selectable="true"
            :is-valid-connection="isValidConnection"
            :min-zoom="0.35"
            :max-zoom="1.8"
            :snap-to-grid="true"
            :snap-grid="[16, 16]"
            fit-view-on-init
            @connect="handleConnect"
            @nodes-change="handleNodesChange"
            @edges-change="handleEdgesChange"
            @pane-click="selectedNodeId = undefined"
          >
            <template #node-flow="{ data, selected }">
              <article
                class="flow-node"
                :class="[`is-${data.node.type}`, { 'is-selected': selected }]"
                :data-node-id="data.node.id"
                @click.stop="selectedNodeId = data.node.id"
              >
                <Handle v-if="data.node.type !== 'trigger'" id="input" type="target" :position="Position.Left" :connectable="!readonly" />
                <component :is="nodeIcon(data.node)" :size="15" aria-hidden="true" />
                <div>
                  <span>{{ locale.t(`flow.nodeType.${data.node.type}`, data.node.type) }}</span>
                  <strong>{{ data.title }}</strong>
                </div>
                <button v-if="data.deletable" type="button" :disabled="readonly" :title="locale.t('flow.deleteNode', 'Delete node')" :aria-label="locale.t('flow.deleteNode', 'Delete node')" @click.stop="removeNode(data.node.id)">
                  <Trash2 :size="12" aria-hidden="true" />
                </button>
                <template v-if="data.node.type === 'condition'">
                  <Handle id="true" class="is-true" type="source" :position="Position.Right" :connectable="!readonly" />
                  <Handle id="false" class="is-false" type="source" :position="Position.Right" :connectable="!readonly" />
                </template>
                <template v-else-if="!['end', 'success', 'failure'].includes(data.node.type)">
                  <Handle id="next" class="is-next" type="source" :position="Position.Right" :connectable="!readonly" />
                  <Handle v-if="data.node.type === 'action'" id="error" class="is-error" type="source" :position="Position.Right" :connectable="!readonly" />
                </template>
              </article>
            </template>
          </VueFlow>
          <p v-if="graphError" class="flow-graph-error" role="alert">{{ graphError }}</p>
        </div>
      </div>

      <aside v-if="selectedFlow" class="flow-inspector" :aria-label="locale.t('flow.inspector', 'Event flow inspector')">
        <section>
          <header>
            <strong>{{ locale.t('flow.settings', 'Event flow settings') }}</strong>
            <code>{{ selectedFlow.version }}</code>
          </header>
          <label>
            <span>{{ locale.t('flow.name', 'Event flow name') }}</span>
            <input :value="selectedFlow.name" :disabled="readonly" :aria-label="locale.t('flow.name', 'Event flow name')" @change="patchSelected({ name: ($event.target as HTMLInputElement).value })">
          </label>
          <label>
            <span>{{ locale.t('flow.trigger', 'Event source') }}</span>
            <ElSelect data-flow-control="trigger" :model-value="selectedFlow.trigger.kind" :disabled="readonly" :aria-label="locale.t('flow.trigger', 'Event source')" @change="updateTrigger">
              <ElOption value="page.mount" :label="locale.t('flow.trigger.mount', 'Page mount')" />
              <ElOption value="form.submit" :label="locale.t('flow.trigger.submit', 'Form submit')" />
              <ElOption value="field.change" :label="locale.t('flow.trigger.change', 'Field change')" :disabled="!fieldNames?.length" />
              <ElOption value="component.event" :label="locale.t('flow.trigger.componentEvent', 'Component event')" :disabled="!eventTargets?.length" />
            </ElSelect>
           </label>
          <label v-if="selectedFlow.trigger.kind === 'field.change'">
            <span>{{ locale.t('flow.field', 'Field') }}</span>
            <ElSelect data-flow-control="field" :model-value="selectedFlow.trigger.field" :disabled="readonly" :aria-label="locale.t('flow.field', 'Field')" @change="updateTriggerField">
              <ElOption v-for="field in fieldNames" :key="field" :value="field" :label="field" />
            </ElSelect>
           </label>
           <label v-if="selectedFlow.trigger.kind === 'component.event'">
             <span>{{ locale.t('flow.eventTarget', 'Event target') }}</span>
             <ElSelect data-flow-control="event-target" :data-selected-value="selectedEventTargetValue" :model-value="selectedEventTargetValue" :disabled="readonly || !eventTargets?.length" :aria-label="locale.t('flow.eventTarget', 'Event target')" @change="updateTriggerEvent">
               <ElOption v-if="!selectedEventTarget" value="" :label="locale.t('flow.eventUnavailable', 'Registered event unavailable')" disabled />
               <ElOption
                 v-for="target in eventTargets"
                 :key="flowEventTargetKey(target)"
                 :value="flowEventTargetKey(target)"
                 :label="`${target.nodeLabel} · ${target.eventLabel} (${target.event})`"
               />
             </ElSelect>
           </label>
          <label>
            <span>{{ locale.t('flow.concurrency', 'Concurrency') }}</span>
            <ElSelect data-flow-control="concurrency" :model-value="selectedFlow.concurrency ?? 'latest'" :disabled="readonly" :aria-label="locale.t('flow.concurrency', 'Concurrency')" @change="updateConcurrency">
              <ElOption value="latest" :label="locale.t('flow.concurrency.latest', 'Latest')" />
              <ElOption value="queue" :label="locale.t('flow.concurrency.queue', 'Queue')" />
              <ElOption value="ignore" :label="locale.t('flow.concurrency.ignore', 'Ignore')" />
            </ElSelect>
          </label>
          <label>
            <span>{{ locale.t('flow.onError', 'On error') }}</span>
            <ElSelect data-flow-control="error-policy" :model-value="selectedFlow.errorPolicy?.onError ?? 'end'" :disabled="readonly" :aria-label="locale.t('flow.onError', 'On error')" @change="updateErrorPolicy">
              <ElOption value="end" :label="locale.t('flow.onError.end', 'End')" />
              <ElOption value="failure" :label="locale.t('flow.onError.failure', 'Failure branch')" />
            </ElSelect>
          </label>
          <label>
            <span>{{ locale.t('flow.timeout', 'Timeout (ms)') }}</span>
            <ElInputNumber
              :model-value="selectedFlow.errorPolicy?.timeoutMs ?? 10000"
              :disabled="readonly"
              :min="0"
              :step="100"
              controls-position="right"
              :aria-label="locale.t('flow.timeout', 'Timeout (ms)')"
              @change="updateTimeout"
            />
          </label>
        </section>

        <section v-if="selectedNode" class="flow-node-inspector">
          <header>
            <strong>{{ locale.t('flow.nodeSettings', 'Node settings') }}</strong>
            <code>{{ selectedNode.type }}</code>
          </header>
          <label>
            <span>{{ locale.t('flow.nodeId', 'Node ID') }}</span>
            <input :value="selectedNode.id" :aria-label="locale.t('flow.nodeId', 'Node ID')" readonly>
          </label>
          <label v-if="selectedNode.type === 'action'">
            <span>{{ locale.t('flow.actionRef', 'Action ref') }}</span>
            <input :value="selectedNode.ref" :disabled="readonly" :aria-label="locale.t('flow.actionRef', 'Action ref')" @change="patchSelectedNode({ ref: ($event.target as HTMLInputElement).value })">
          </label>
          <label v-if="['condition', 'reaction', 'action'].includes(selectedNode.type)">
            <span>{{ locale.t('flow.nodeConfig', 'Node config') }}</span>
            <textarea v-model="nodeConfigDraft" :disabled="readonly" :aria-label="locale.t('flow.nodeConfig', 'Node config')" spellcheck="false" @blur="commitNodeConfig" />
          </label>
          <button v-if="isNodeDeletable(selectedNode)" type="button" class="is-danger" :disabled="readonly" @click="removeNode(selectedNode.id)">
            <Trash2 :size="14" aria-hidden="true" />{{ locale.t('flow.deleteNode', 'Delete node') }}
          </button>
        </section>
      </aside>
    </div>

    <div v-else class="flow-empty">
      <GitBranch :size="24" aria-hidden="true" />
      <strong>{{ locale.t('flow.empty.title', 'No event flows configured') }}</strong>
      <button type="button" :disabled="readonly" data-testid="create-first-flow" @click="openFlowCreator">
        <Plus :size="14" aria-hidden="true" />{{ locale.t('flow.empty.action', 'Choose an event') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.flow-workspace { display: grid; height: 100%; min-height: 0; grid-template-rows: 44px minmax(0, 1fr); color: var(--wb-text); background: var(--wb-surface); }
.flow-workspace-header { display: flex; min-width: 0; padding: 7px 10px; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid var(--wb-separator); }
.flow-workspace-header > div:first-child { display: flex; min-width: 0; align-items: baseline; gap: 8px; }
.flow-workspace-header small { color: var(--wb-muted); font-size: 10px; }
.flow-workspace button { display: inline-flex; min-height: 28px; padding: 0 8px; align-items: center; justify-content: center; gap: 5px; color: var(--wb-text); border: 1px solid var(--wb-control-border); border-radius: 4px; background: var(--wb-bg); cursor: pointer; white-space: nowrap; }
.flow-workspace button:hover:not(:disabled), .flow-list-item.is-active { border-color: var(--wb-accent); background: var(--wb-hover); }
.flow-workspace button:disabled { cursor: default; opacity: .5; }
.flow-create-control { display: inline-flex; flex: 0 0 auto; }
.flow-trigger-menu { box-sizing: border-box; width: min(310px, calc(100vw - 32px)); max-height: min(520px, calc(100vh - 120px)); overflow: auto; }
.flow-trigger-group-label { padding: 6px 12px 3px; color: var(--wb-muted); font-size: 9px; font-weight: 700; text-transform: uppercase; }
.flow-trigger-group-label:not(:first-child) { margin-top: 4px; border-top: 1px solid var(--wb-separator); }
.flow-trigger-menu :deep(.el-dropdown-menu__item) { display: grid; min-width: 0; min-height: 38px; padding: 5px 9px; justify-content: stretch; grid-template-columns: 16px minmax(0, 1fr); gap: 6px; line-height: 1.3; }
.flow-trigger-menu :deep(.el-dropdown-menu__item.is-preferred) { background: var(--wb-accent-soft); }
.flow-trigger-menu :deep(.el-dropdown-menu__item > svg) { color: var(--wb-accent); }
.flow-trigger-menu :deep(.el-dropdown-menu__item > span) { display: grid; min-width: 0; gap: 1px; }
.flow-trigger-menu b, .flow-trigger-menu code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.flow-trigger-menu b { font-size: 11px; font-weight: 600; }
.flow-trigger-menu code { color: var(--wb-muted); font-size: 9px; }
.flow-workspace-body { position: relative; display: grid; min-width: 0; min-height: 0; grid-template-columns: 168px minmax(320px, 1fr) 248px; }
.flow-list { min-width: 0; padding: 6px; overflow: auto; border-right: 1px solid var(--wb-separator); }
.flow-list-item { display: grid; grid-template-columns: minmax(0, 1fr) 28px; margin-bottom: 4px; border: 1px solid transparent; border-radius: 5px; }
.flow-list-item > button:first-child { display: grid; min-width: 0; min-height: 46px; grid-template-columns: minmax(0, 1fr); justify-items: start; text-align: left; border: 0; background: transparent; }
.flow-list-item > button:first-child span { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.flow-list-item > button:first-child small { width: 100%; overflow: hidden; color: var(--wb-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.flow-list-item > button:last-child { width: 24px; min-height: 24px; margin: 4px 3px 0 0; padding: 0; color: var(--wb-muted); border-color: transparent; background: transparent; }
.flow-editor { display: grid; min-width: 0; min-height: 0; grid-template-rows: auto minmax(0, 1fr); }
.flow-editor-toolbar { display: flex; min-width: 0; min-height: 48px; padding: 7px 9px; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid var(--wb-separator); }
.flow-editor-title { display: grid; min-width: 0; }
.flow-editor-title strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.flow-editor-title code { color: var(--wb-muted); font-size: 9px; }
.flow-node-palette { display: flex; min-width: 0; overflow-x: auto; gap: 5px; }
.flow-node-palette button { flex: 0 0 auto; font-size: 11px; }
.flow-graph-shell { position: relative; min-width: 0; min-height: 0; overflow: hidden; background: var(--wb-bg); }
.flow-graph { width: 100%; height: 100%; background: var(--wb-bg); }
.flow-graph :deep(.vue-flow__pane) { cursor: default; }
.flow-graph :deep(.vue-flow__edge-path) { stroke: var(--wb-control-border); stroke-width: 1.5; }
.flow-graph :deep(.vue-flow__edge.is-true .vue-flow__edge-path) { stroke: #35a66f; }
.flow-graph :deep(.vue-flow__edge.is-false .vue-flow__edge-path), .flow-graph :deep(.vue-flow__edge.is-error .vue-flow__edge-path) { stroke: var(--wb-danger); }
.flow-graph :deep(.vue-flow__edge-textbg) { fill: var(--wb-elevated); }
.flow-graph :deep(.vue-flow__edge-text) { fill: var(--wb-muted); font-size: 10px; }
.flow-graph :deep(.vue-flow__node) { width: 176px; }
.flow-node { position: relative; display: grid; width: 176px; min-height: 62px; grid-template-columns: 22px minmax(0, 1fr) 22px; padding: 9px 7px; align-items: center; gap: 6px; color: var(--wb-text); border: 1px solid var(--wb-control-border); border-radius: 6px; background: var(--wb-elevated); box-shadow: 0 5px 14px rgb(0 0 0 / 18%); }
.flow-node.is-selected { border-color: var(--wb-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--wb-accent) 24%, transparent), 0 7px 18px rgb(0 0 0 / 20%); }
.flow-node.is-trigger { border-left: 3px solid var(--wb-accent); }
.flow-node.is-condition { border-left: 3px solid #d49a22; }
.flow-node.is-end, .flow-node.is-success { border-left: 3px solid #35a66f; }
.flow-node.is-failure { border-left: 3px solid var(--wb-danger); }
.flow-node > div { display: grid; min-width: 0; gap: 1px; }
.flow-node > div span { color: var(--wb-muted); font-size: 9px; text-transform: uppercase; }
.flow-node > div strong { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.flow-node > button { width: 22px; min-height: 22px; padding: 0; color: var(--wb-muted); border-color: transparent; background: transparent; }
.flow-node :deep(.vue-flow__handle) { width: 9px; height: 9px; background: var(--wb-accent); border: 2px solid var(--wb-elevated); }
.flow-node :deep(.vue-flow__handle.is-true) { top: 34%; background: #35a66f; }
.flow-node :deep(.vue-flow__handle.is-false) { top: 68%; background: var(--wb-danger); }
.flow-node :deep(.vue-flow__handle.is-next) { top: 50%; }
.flow-node :deep(.vue-flow__handle.is-error) { top: 76%; background: var(--wb-danger); }
.flow-graph-error { position: absolute; z-index: 5; right: 10px; bottom: 10px; max-width: min(420px, calc(100% - 20px)); margin: 0; padding: 7px 9px; color: #ffd6d6; border: 1px solid color-mix(in srgb, var(--wb-danger) 72%, transparent); border-radius: 5px; background: color-mix(in srgb, var(--wb-danger) 24%, var(--wb-elevated)); font-size: 11px; }
.flow-inspector { min-width: 0; overflow: auto; border-left: 1px solid var(--wb-separator); background: var(--wb-surface); }
.flow-inspector section { display: grid; padding: 10px; gap: 9px; border-bottom: 1px solid var(--wb-separator); }
.flow-inspector section > header { display: flex; align-items: center; justify-content: space-between; }
.flow-inspector section > header strong { font-size: 11px; }
.flow-inspector code { color: var(--wb-muted); font-size: 9px; }
.flow-inspector label { display: grid; min-width: 0; gap: 4px; color: var(--wb-muted); font-size: 10px; }
.flow-inspector input, .flow-inspector textarea { box-sizing: border-box; width: 100%; min-width: 0; color: var(--wb-text); border: 1px solid var(--wb-control-border); border-radius: 4px; outline: 0; background: var(--wb-bg); font: inherit; }
.flow-inspector input { height: 28px; padding: 0 7px; }
.flow-inspector textarea { min-height: 120px; padding: 7px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; line-height: 1.45; }
.flow-inspector input:focus, .flow-inspector textarea:focus { border-color: var(--wb-accent); }
.flow-inspector :deep(.el-select), .flow-inspector :deep(.el-input-number) { width: 100%; }
.flow-inspector button.is-danger { color: #ffb9b9; border-color: color-mix(in srgb, var(--wb-danger) 70%, transparent); background: color-mix(in srgb, var(--wb-danger) 14%, transparent); }
.flow-empty { display: grid; min-height: 180px; place-content: center; justify-items: center; gap: 10px; padding: 20px; text-align: center; }
.flow-empty > svg { color: var(--wb-muted); }

@media (max-width: 900px) {
  .flow-workspace-body { grid-template-columns: 132px minmax(280px, 1fr); }
  .flow-inspector { position: absolute; z-index: 10; right: 0; bottom: 0; width: min(260px, 80%); max-height: calc(100% - 93px); border-top: 1px solid var(--wb-separator); box-shadow: -10px 0 30px rgb(0 0 0 / 22%); }
  .flow-editor-toolbar { align-items: flex-start; flex-direction: column; }
}

@media (max-width: 620px) {
  .flow-workspace-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: 62px minmax(0, 1fr); }
  .flow-list { display: flex; min-width: 0; padding: 6px; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--wb-separator); }
  .flow-list-item { flex: 0 0 138px; margin: 0 4px 0 0; }
  .flow-editor-title { display: none; }
  .flow-node-palette { width: 100%; }
  .flow-node-palette button { flex: 1 0 auto; }
  .flow-inspector { right: 0; left: 0; box-sizing: border-box; width: 100%; max-height: 44%; border-left: 0; }
}
</style>
