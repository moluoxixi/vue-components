<script setup lang="ts">
import type {
  ConfigFormFlow,
  ConfigFormFlowEdge,
  ConfigFormFlowNode,
  ConfigFormFlowNodeType,
  ConfigFormFlowTrigger,
  ConfigFormJsonObject,
} from '@moluoxixi/config-form-core'
import type { ProjectCommandAction } from '@moluoxixi/config-form-model'
import type { Connection, Edge, EdgeChange, Node, NodeChange, XYPosition } from '@vue-flow/core'
import type {
  FlowNodeData,
  FlowTriggerChoice,
  FlowTriggerGroup,
  FlowWorkspaceEmits,
  FlowWorkspaceProps,
} from './types'
import {
  CircleStop,
  GitBranch,
  Play,
  Plus,
  Trash2,
  Zap,
} from '@lucide/vue'
import { analyzeConfigFormFlow } from '@moluoxixi/config-form-core'
import { createDesignerLocale, useDesignerLocale } from '@moluoxixi/config-form-designer'
import { Handle, Position, VueFlow } from '@vue-flow/core'
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { flowEventTargetKey } from '../../../../flow'
import { cloneWorkbenchJson } from '../../../../utils'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

type FlowEditAction = Extract<ProjectCommandAction, {
  type: 'flow.settings' | 'flow.node' | 'flow.edges' | 'flow.graph'
}>

const props = defineProps<FlowWorkspaceProps>()

const emit = defineEmits<FlowWorkspaceEmits>()
let commandSequence = 0
const inheritedLocale = useDesignerLocale()
const locale = computed(() => props.locale ? createDesignerLocale(props.locale) : inheritedLocale)

const selectedId = ref<string>()
const selectedNodeId = ref<string>()
const flowCreatorOpen = ref(false)
const graphError = ref('')
const nodeConfigDraft = ref('')
const draftPositions = shallowRef<Record<string, XYPosition>>({})
const addFlowButton = useTemplateRef<{ $el?: HTMLButtonElement }>('addFlowButton')
const flowCreator = useTemplateRef<{ handleClose: () => void, handleOpen: () => void }>('flowCreator')

watch(() => props.flows, (flows) => {
  if (!flows.some(flow => flow.id === selectedId.value))
    selectedId.value = flows[0]?.id
}, { immediate: true, deep: true })

const selectedFlow = computed(() => props.flows.find(flow => flow.id === selectedId.value))
const selectedNode = computed(() => selectedFlow.value?.nodes.find(node => node.id === selectedNodeId.value))
const selectedEventTarget = computed(() => {
  const trigger = selectedFlow.value?.trigger
  if (trigger?.kind !== 'component.event')
    return undefined
  return props.eventTargets?.find(target => target.nodeId === trigger.nodeId && target.event === trigger.event)
})
const selectedEventTargetValue = computed(() => selectedEventTarget.value
  ? flowEventTargetKey(selectedEventTarget.value)
  : '')
const triggerChoices = computed<FlowTriggerChoice[]>(() => {
  const choices: FlowTriggerChoice[] = [
    createTriggerChoice(
      { kind: 'page.mount' },
      'lifecycle',
      locale.value.t('flow.trigger.mount', 'Page mount'),
      'page.mount',
    ),
    createTriggerChoice(
      { kind: 'form.submit' },
      'form',
      locale.value.t('flow.trigger.submit', 'Form submit'),
      'form.submit',
    ),
  ]
  for (const field of [...new Set(props.fieldNames ?? [])]) {
    choices.push(createTriggerChoice(
      { kind: 'field.change', field },
      'field',
      `${field} · ${locale.value.t('flow.trigger.change', 'Field change')}`,
      'field.change',
    ))
  }
  for (const target of props.eventTargets ?? []) {
    choices.push(createTriggerChoice(
      { kind: 'component.event', nodeId: target.nodeId, event: target.event },
      'component',
      `${target.nodeLabel} · ${target.eventLabel}`,
      target.event,
    ))
  }
  return choices
})
const triggerGroups = computed(() => (['lifecycle', 'form', 'field', 'component'] as const)
  .map(group => ({
    group,
    label: locale.value.t(`flow.triggerGroup.${group}`, group[0]!.toUpperCase() + group.slice(1)),
    choices: triggerChoices.value.filter(choice => choice.group === group),
  }))
  .filter(group => group.choices.length > 0))
const initialTriggerKey = computed(() => props.initialTrigger ? triggerKey(props.initialTrigger) : '')

watch(() => selectedFlow.value?.id, () => {
  selectedNodeId.value = undefined
  graphError.value = ''
  draftPositions.value = {}
})

watch(() => props.initialTrigger, (trigger) => {
  if (!trigger)
    return
  const matchingFlow = props.flows.find(flow => triggersEqual(flow.trigger, trigger))
  if (matchingFlow) {
    selectedId.value = matchingFlow.id
    closeFlowCreator()
    return
  }
  openFlowCreator()
}, { immediate: true, deep: true })

watch(selectedNode, (node) => {
  nodeConfigDraft.value = node?.config ? JSON.stringify(node.config, null, 2) : ''
}, { immediate: true, deep: true })

const graphNodes = computed<Node<FlowNodeData>[]>(() => (selectedFlow.value?.nodes ?? []).map((node, index) => ({
  id: node.id,
  type: 'flow',
  position: draftPositions.value[node.id] ?? node.position ?? defaultNodePosition(node, index),
  selected: selectedNodeId.value === node.id,
  draggable: !props.readonly,
  selectable: true,
  deletable: isNodeDeletable(node) && !props.readonly,
  data: {
    node,
    title: nodeTitle(node),
    deletable: isNodeDeletable(node),
  },
})))

const graphEdges = computed<Edge[]>(() => (selectedFlow.value?.edges ?? []).map(edge => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  sourceHandle: edge.condition ?? 'next',
  targetHandle: 'input',
  type: 'smoothstep',
  label: edge.condition && edge.condition !== 'next' ? edge.condition : undefined,
  class: `is-${edge.condition ?? 'next'}`,
  deletable: !props.readonly,
  selectable: !props.readonly,
})))

function emitCommand(label: string, action: ProjectCommandAction): void {
  emit('command', {
    id: `flow-${Date.now().toString(36)}-${++commandSequence}`,
    label,
    actions: [cloneWorkbenchJson(action)],
  })
}

function commitSelectedFlow(candidate: ConfigFormFlow, action: FlowEditAction): boolean {
  if (props.readonly)
    return false
  const analyzed = analyzeConfigFormFlow(candidate)
  if (!analyzed.success) {
    graphError.value = analyzed.diagnostics[0]?.message ?? locale.value.t('flow.invalid', 'Flow is invalid')
    return false
  }
  graphError.value = ''
  emitCommand('Update flow', action)
  return true
}

function selectedFlowSettings(flow: ConfigFormFlow): Extract<ProjectCommandAction, { type: 'flow.settings' }>['settings'] {
  return {
    name: flow.name,
    trigger: cloneWorkbenchJson(flow.trigger),
    ...(flow.concurrency === undefined ? {} : { concurrency: flow.concurrency }),
    ...(flow.errorPolicy === undefined ? {} : { errorPolicy: cloneWorkbenchJson(flow.errorPolicy) }),
  }
}

function addFlow(trigger: ConfigFormFlowTrigger): void {
  const ids = new Set(props.flows.map(flow => flow.id))
  let index = props.flows.length + 1
  while (ids.has(`flow-${index}`)) index += 1
  const id = `flow-${index}`
  const flow: ConfigFormFlow = {
    version: 1,
    id,
    name: locale.value.t('flow.defaultName', 'On {event}', { event: flowTriggerLabel(trigger) }),
    trigger: cloneWorkbenchJson(trigger),
    concurrency: 'latest',
    errorPolicy: { onError: 'end', timeoutMs: 10000 },
    nodes: [
      { id: `${id}-trigger`, type: 'trigger', position: { x: 60, y: 140 } },
      { id: `${id}-end`, type: 'end', position: { x: 420, y: 140 } },
    ],
    edges: [{ id: `${id}-next`, source: `${id}-trigger`, target: `${id}-end`, condition: 'next' }],
  }
  emitCommand('Add flow', {
    type: 'operation.apply',
    operations: [{ type: 'flow.add', pageId: props.pageId, flow }],
  })
  selectedId.value = id
  closeFlowCreator()
}

function createTriggerChoice(
  trigger: ConfigFormFlowTrigger,
  group: FlowTriggerGroup,
  label: string,
  detail: string,
): FlowTriggerChoice {
  return { detail, group, key: triggerKey(trigger), label, trigger }
}

function triggerKey(trigger: ConfigFormFlowTrigger): string {
  if (trigger.kind === 'field.change')
    return JSON.stringify([trigger.kind, trigger.field ?? ''])
  if (trigger.kind === 'component.event')
    return JSON.stringify([trigger.kind, trigger.nodeId ?? '', trigger.event ?? ''])
  return JSON.stringify([trigger.kind])
}

function triggersEqual(left: ConfigFormFlowTrigger, right: ConfigFormFlowTrigger): boolean {
  return triggerKey(left) === triggerKey(right)
}

function flowTriggerLabel(trigger: ConfigFormFlowTrigger): string {
  const choice = triggerChoices.value.find(candidate => triggersEqual(candidate.trigger, trigger))
  if (choice)
    return choice.label
  if (trigger.kind === 'field.change')
    return `${trigger.field ?? locale.value.t('flow.eventUnavailable', 'Registered event unavailable')} · ${locale.value.t('flow.trigger.change', 'Field change')}`
  if (trigger.kind === 'component.event')
    return `${trigger.nodeId ?? '?'} · ${trigger.event ?? locale.value.t('flow.eventUnavailable', 'Registered event unavailable')}`
  return locale.value.t(`flow.trigger.${trigger.kind === 'page.mount' ? 'mount' : 'submit'}`, trigger.kind)
}

function openFlowCreator(): void {
  if (props.readonly)
    return
  flowCreatorOpen.value = true
  void nextTick(() => {
    addFlowButton.value?.$el?.focus()
    flowCreator.value?.handleOpen()
  })
}

function closeFlowCreator(): void {
  flowCreatorOpen.value = false
  flowCreator.value?.handleClose()
}

function removeFlow(id: string): void {
  if (!props.readonly)
    emitCommand('Remove flow', {
      type: 'operation.apply',
      operations: [{ type: 'flow.remove', pageId: props.pageId, flowId: id }],
    })
}

function patchSelected(patch: Partial<ConfigFormFlow>): void {
  const flow = selectedFlow.value
  if (!flow)
    return
  const candidate = { ...cloneWorkbenchJson(flow), ...patch }
  commitSelectedFlow(candidate, {
    type: 'flow.settings',
    pageId: props.pageId,
    flowId: candidate.id,
    settings: selectedFlowSettings(candidate),
  })
}

function updateTrigger(kind: ConfigFormFlow['trigger']['kind']): void {
  if (kind === 'field.change') {
    const field = selectedFlow.value?.trigger.field ?? props.fieldNames?.[0]
    if (!field) {
      graphError.value = locale.value.t('flow.fieldRequired', 'Select a registered field first')
      return
    }
    patchSelected({ trigger: { kind, field } })
    return
  }
  if (kind === 'component.event') {
    const target = selectedEventTarget.value ?? props.eventTargets?.[0]
    if (!target) {
      graphError.value = locale.value.t('flow.eventRequired', 'Select a registered component event first')
      return
    }
    patchSelected({ trigger: { kind, nodeId: target.nodeId, event: target.event } })
    return
  }
  patchSelected({ trigger: { kind } })
}

function updateTriggerField(field: string): void {
  if (selectedFlow.value?.trigger.kind === 'field.change' && field)
    patchSelected({ trigger: { kind: 'field.change', field } })
}

function updateTriggerEvent(value: string): void {
  if (selectedFlow.value?.trigger.kind !== 'component.event' || !value)
    return
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== 'string' || typeof parsed[1] !== 'string')
      throw new TypeError('Invalid component event target')
    const target = props.eventTargets?.find(candidate => candidate.nodeId === parsed[0] && candidate.event === parsed[1])
    if (!target) {
      graphError.value = locale.value.t('flow.eventRequired', 'Select a registered component event first')
      return
    }
    patchSelected({ trigger: { kind: 'component.event', nodeId: target.nodeId, event: target.event } })
  }
  catch {
    graphError.value = locale.value.t('flow.eventRequired', 'Select a registered component event first')
  }
}

function updateConcurrency(value: string): void {
  if (value === 'latest' || value === 'queue' || value === 'ignore')
    patchSelected({ concurrency: value })
}

function updateErrorPolicy(onError: 'failure' | 'end'): void {
  patchSelected({
    errorPolicy: {
      onError,
      timeoutMs: selectedFlow.value?.errorPolicy?.timeoutMs ?? 10000,
    },
  })
}

function updateTimeout(value: number | undefined): void {
  const timeoutMs = Number(value)
  if (Number.isInteger(timeoutMs) && timeoutMs >= 0) {
    patchSelected({
      errorPolicy: {
        onError: selectedFlow.value?.errorPolicy?.onError ?? 'end',
        timeoutMs,
      },
    })
  }
}

function uniqueNodeId(flow: ConfigFormFlow, type: ConfigFormFlowNodeType): string {
  const ids = new Set(flow.nodes.map(node => node.id))
  let index = 1
  while (ids.has(`${flow.id}-${type}-${index}`)) index += 1
  return `${flow.id}-${type}-${index}`
}

function uniqueEdgeId(flow: ConfigFormFlow, source: string, condition: string, target: string): string {
  const base = `${source}-${condition}-${target}`.replace(/[^a-zA-Z0-9_-]/g, '-')
  const ids = new Set(flow.edges.map(edge => edge.id))
  if (!ids.has(base))
    return base
  let index = 2
  while (ids.has(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}

function addNode(type: Exclude<ConfigFormFlowNodeType, 'trigger' | 'success' | 'failure' | 'end'>): void {
  const current = selectedFlow.value
  if (!current)
    return
  const flow = cloneWorkbenchJson(current)
  const terminal = flow.nodes.find(node => node.type === 'end' || node.type === 'success' || node.type === 'failure')
  if (!terminal)
    return
  const id = uniqueNodeId(flow, type)
  const terminalPosition = terminal.position ?? { x: 420, y: 140 }
  const node: ConfigFormFlowNode = {
    id,
    type,
    position: { x: Math.max(180, terminalPosition.x - 220), y: terminalPosition.y },
    ...(type === 'action' ? { ref: 'notify', config: {} } : {}),
    ...(type === 'condition' ? { config: { condition: { kind: 'literal', value: true } } } : {}),
    ...(type === 'reaction' ? { config: { reactions: [] } } : {}),
  }
  terminal.position = { x: terminalPosition.x + 220, y: terminalPosition.y }
  const incoming = flow.edges.filter(edge => edge.target === terminal.id && edge.condition !== 'error')
  incoming.forEach((edge) => {
    edge.target = id
  })
  const terminalIndex = flow.nodes.indexOf(terminal)
  flow.nodes.splice(terminalIndex < 0 ? flow.nodes.length : terminalIndex, 0, node)
  if (type === 'condition') {
    flow.edges.push(
      { id: uniqueEdgeId(flow, id, 'true', terminal.id), source: id, target: terminal.id, condition: 'true' },
      { id: uniqueEdgeId(flow, id, 'false', terminal.id), source: id, target: terminal.id, condition: 'false' },
    )
  }
  else {
    flow.edges.push({ id: uniqueEdgeId(flow, id, 'next', terminal.id), source: id, target: terminal.id, condition: 'next' })
  }
  if (commitSelectedFlow(flow, {
    type: 'flow.graph',
    pageId: props.pageId,
    flowId: flow.id,
    nodes: flow.nodes,
    edges: flow.edges,
  }))
    selectedNodeId.value = id
}

function isNodeDeletable(node: ConfigFormFlowNode): boolean {
  return !['trigger', 'end', 'success', 'failure'].includes(node.type)
}

function removeNode(nodeId: string): void {
  const current = selectedFlow.value
  const removed = current?.nodes.find(node => node.id === nodeId)
  if (!current || !removed || !isNodeDeletable(removed))
    return
  const flow = cloneWorkbenchJson(current)
  const incoming = flow.edges.filter(edge => edge.target === nodeId)
  const outgoing = flow.edges.filter(edge => edge.source === nodeId && edge.condition !== 'error')
  const targetIds = [...new Set(outgoing.map(edge => edge.target))]
  if (targetIds.length !== 1) {
    graphError.value = locale.value.t('flow.deleteBranching', 'Reconnect branching paths before deleting this node')
    return
  }
  flow.edges = flow.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId)
  for (const source of incoming) {
    flow.edges.push({
      id: uniqueEdgeId(flow, source.source, source.condition ?? 'next', targetIds[0]!),
      source: source.source,
      target: targetIds[0]!,
      condition: source.condition ?? 'next',
    })
  }
  flow.nodes = flow.nodes.filter(node => node.id !== nodeId)
  if (commitSelectedFlow(flow, {
    type: 'flow.graph',
    pageId: props.pageId,
    flowId: flow.id,
    nodes: flow.nodes,
    edges: flow.edges,
  }))
    selectedNodeId.value = undefined
}

function edgeCondition(flow: ConfigFormFlow, connection: Connection): ConfigFormFlowEdge['condition'] | undefined {
  const source = flow.nodes.find(node => node.id === connection.source)
  if (!source || ['success', 'failure', 'end'].includes(source.type))
    return undefined
  if (source.type === 'condition')
    return connection.sourceHandle === 'true' || connection.sourceHandle === 'false' ? connection.sourceHandle : undefined
  if (source.type === 'action' && connection.sourceHandle === 'error')
    return 'error'
  return connection.sourceHandle === 'next' || connection.sourceHandle === null || connection.sourceHandle === undefined
    ? 'next'
    : undefined
}

function candidateConnection(connection: Connection): ConfigFormFlow | undefined {
  const current = selectedFlow.value
  if (!current || connection.source === connection.target)
    return undefined
  const flow = cloneWorkbenchJson(current)
  const target = flow.nodes.find(node => node.id === connection.target)
  const condition = edgeCondition(flow, connection)
  if (!target || target.type === 'trigger' || !condition)
    return undefined
  flow.edges = flow.edges.filter(edge => !(edge.source === connection.source && (edge.condition ?? 'next') === condition))
  flow.edges.push({
    id: uniqueEdgeId(flow, connection.source, condition, connection.target),
    source: connection.source,
    target: connection.target,
    condition,
  })
  return flow
}

function isValidConnection(connection: Connection): boolean {
  const candidate = candidateConnection(connection)
  return candidate ? analyzeConfigFormFlow(candidate).success : false
}

function handleConnect(connection: Connection): void {
  const candidate = candidateConnection(connection)
  if (candidate)
    commitSelectedFlow(candidate, { type: 'flow.edges', pageId: props.pageId, flowId: candidate.id, edges: candidate.edges })
}

function handleNodesChange(changes: NodeChange[]): void {
  if (props.readonly)
    return
  for (const change of changes) {
    if (change.type === 'select' && change.selected)
      selectedNodeId.value = change.id
    else if (change.type === 'remove')
      removeNode(change.id)
    else if (change.type === 'position') {
      draftPositions.value = { ...draftPositions.value, [change.id]: { ...change.position } }
      if (!change.dragging)
        commitNodePosition(change.id, change.position)
    }
  }
}

function commitNodePosition(nodeId: string, position: XYPosition): void {
  const current = selectedFlow.value
  if (!current)
    return
  const flow = cloneWorkbenchJson(current)
  const node = flow.nodes.find(candidate => candidate.id === nodeId)
  if (!node)
    return
  node.position = { x: Math.round(position.x), y: Math.round(position.y) }
  if (commitSelectedFlow(flow, {
    type: 'flow.node',
    pageId: props.pageId,
    flowId: flow.id,
    nodeId,
    node,
  })) {
    const next = { ...draftPositions.value }
    delete next[nodeId]
    draftPositions.value = next
  }
}

function handleEdgesChange(changes: EdgeChange[]): void {
  const current = selectedFlow.value
  const removedIds = changes.filter(change => change.type === 'remove').map(change => change.id)
  if (!current || removedIds.length === 0)
    return
  const flow = cloneWorkbenchJson(current)
  flow.edges = flow.edges.filter(edge => !removedIds.includes(edge.id))
  commitSelectedFlow(flow, { type: 'flow.edges', pageId: props.pageId, flowId: flow.id, edges: flow.edges })
}

function patchSelectedNode(patch: Partial<ConfigFormFlowNode>): void {
  const current = selectedFlow.value
  if (!current || !selectedNodeId.value)
    return
  const flow = cloneWorkbenchJson(current)
  const node = flow.nodes.find(candidate => candidate.id === selectedNodeId.value)
  if (!node)
    return
  Object.assign(node, patch)
  commitSelectedFlow(flow, {
    type: 'flow.node',
    pageId: props.pageId,
    flowId: flow.id,
    nodeId: node.id,
    node,
  })
}

function commitNodeConfig(): void {
  if (!selectedNode.value || !['condition', 'reaction', 'action'].includes(selectedNode.value.type))
    return
  try {
    const parsed = JSON.parse(nodeConfigDraft.value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error(locale.value.t('flow.configObject', 'Node config must be a JSON object'))
    patchSelectedNode({ config: parsed as ConfigFormJsonObject })
  }
  catch (error) {
    graphError.value = error instanceof Error ? error.message : String(error)
  }
}

function defaultNodePosition(node: ConfigFormFlowNode, index: number): XYPosition {
  if (node.type === 'failure')
    return { x: 280, y: 300 }
  return { x: 60 + index * 220, y: 140 }
}

function nodeTitle(node: ConfigFormFlowNode): string {
  if (node.type === 'trigger' && selectedFlow.value)
    return flowTriggerLabel(selectedFlow.value.trigger)
  if (node.type === 'action' && node.ref)
    return node.ref
  return locale.value.t(`flow.node.${node.type}`, node.type[0]!.toUpperCase() + node.type.slice(1))
}

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
