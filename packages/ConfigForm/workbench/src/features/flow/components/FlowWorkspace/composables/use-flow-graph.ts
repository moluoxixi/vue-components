import type {
  ConfigFormFlow,
  ConfigFormFlowNode,
  ConfigFormFlowNodeType,
  ConfigFormJsonObject,
} from '@moluoxixi/config-form-core'
import type { createDesignerLocale } from '@moluoxixi/config-form-designer'
import type { Connection, EdgeChange, NodeChange, XYPosition } from '@vue-flow/core'
import type { ComputedRef, Ref } from 'vue'
import type { FlowEditAction } from '../types/edit-action'
import { analyzeConfigFormFlow } from '@moluoxixi/config-form-core'
import { computed, ref, shallowRef, watch } from 'vue'
import {
  connectFlowNodes,
  insertFlowNode,
  isNodeDeletable,
  patchFlowNode,
  positionFlowNode,
  projectFlowEdges,
  projectFlowNodes,
  removeFlowEdges,
  removeFlowNode,
} from '../services'

export function useFlowGraph(options: {
  commitSelectedFlow: (candidate: ConfigFormFlow, action: FlowEditAction) => boolean
  flowTriggerLabel: (trigger: ConfigFormFlow['trigger']) => string
  graphError: Ref<string>
  locale: ComputedRef<ReturnType<typeof createDesignerLocale>>
  pageId: () => string
  readonly: () => boolean
  selectedFlow: ComputedRef<ConfigFormFlow | undefined>
}) {
  const {
    commitSelectedFlow,
    flowTriggerLabel,
    graphError,
    locale,
    pageId,
    readonly,
    selectedFlow,
  } = options
  const selectedNodeId = ref<string>()
  const nodeConfigDraft = ref('')
  const draftPositions = shallowRef<Record<string, XYPosition>>({})
  const selectedNode = computed(() => selectedFlow.value?.nodes.find(node => node.id === selectedNodeId.value))

  watch(() => selectedFlow.value?.id, () => {
    selectedNodeId.value = undefined
    graphError.value = ''
    draftPositions.value = {}
  })

  watch(selectedNode, (node) => {
    nodeConfigDraft.value = node?.config ? JSON.stringify(node.config, null, 2) : ''
  }, { immediate: true, deep: true })

  function nodeTitle(node: ConfigFormFlowNode): string {
    if (node.type === 'trigger' && selectedFlow.value)
      return flowTriggerLabel(selectedFlow.value.trigger)
    if (node.type === 'action' && node.ref)
      return node.ref
    return locale.value.t(`flow.node.${node.type}`, node.type[0]!.toUpperCase() + node.type.slice(1))
  }

  const graphNodes = computed(() => projectFlowNodes(
    selectedFlow.value,
    draftPositions.value,
    selectedNodeId.value,
    readonly(),
    nodeTitle,
  ))
  const graphEdges = computed(() => projectFlowEdges(selectedFlow.value, readonly()))

  function addNode(type: Exclude<ConfigFormFlowNodeType, 'trigger' | 'success' | 'failure' | 'end'>): void {
    const current = selectedFlow.value
    if (!current)
      return
    const result = insertFlowNode(current, type)
    if (!result)
      return
    if (commitSelectedFlow(result.flow, {
      type: 'flow.graph',
      pageId: pageId(),
      flowId: result.flow.id,
      nodes: result.flow.nodes,
      edges: result.flow.edges,
    })) {
      selectedNodeId.value = result.nodeId
    }
  }

  function removeNode(nodeId: string): void {
    const current = selectedFlow.value
    if (!current)
      return
    const result = removeFlowNode(current, nodeId)
    if (!result)
      return
    if (result.reason === 'branching') {
      graphError.value = locale.value.t('flow.deleteBranching', 'Reconnect branching paths before deleting this node')
      return
    }
    if (!result.flow)
      return
    if (commitSelectedFlow(result.flow, {
      type: 'flow.graph',
      pageId: pageId(),
      flowId: result.flow.id,
      nodes: result.flow.nodes,
      edges: result.flow.edges,
    })) {
      selectedNodeId.value = undefined
    }
  }

  function candidateConnection(connection: Connection): ConfigFormFlow | undefined {
    const current = selectedFlow.value
    return current ? connectFlowNodes(current, connection) : undefined
  }

  function isValidConnection(connection: Connection): boolean {
    const candidate = candidateConnection(connection)
    return candidate ? analyzeConfigFormFlow(candidate).success : false
  }

  function handleConnect(connection: Connection): void {
    const candidate = candidateConnection(connection)
    if (candidate) {
      commitSelectedFlow(candidate, {
        type: 'flow.edges',
        pageId: pageId(),
        flowId: candidate.id,
        edges: candidate.edges,
      })
    }
  }

  function handleNodesChange(changes: NodeChange[]): void {
    if (readonly())
      return
    for (const change of changes) {
      if (change.type === 'select' && change.selected) {
        selectedNodeId.value = change.id
      }
      else if (change.type === 'remove') {
        removeNode(change.id)
      }
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
    const result = positionFlowNode(current, nodeId, position)
    if (!result)
      return
    if (commitSelectedFlow(result.flow, {
      type: 'flow.node',
      pageId: pageId(),
      flowId: result.flow.id,
      nodeId,
      node: result.node,
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
    const flow = removeFlowEdges(current, removedIds)
    commitSelectedFlow(flow, { type: 'flow.edges', pageId: pageId(), flowId: flow.id, edges: flow.edges })
  }

  function patchSelectedNode(patch: Partial<ConfigFormFlowNode>): void {
    const current = selectedFlow.value
    const nodeId = selectedNodeId.value
    if (!current || !nodeId)
      return
    const result = patchFlowNode(current, nodeId, patch)
    if (!result)
      return
    commitSelectedFlow(result.flow, {
      type: 'flow.node',
      pageId: pageId(),
      flowId: result.flow.id,
      nodeId: result.node.id,
      node: result.node,
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

  return {
    addNode,
    commitNodeConfig,
    graphEdges,
    graphNodes,
    handleConnect,
    handleEdgesChange,
    handleNodesChange,
    isNodeDeletable,
    isValidConnection,
    nodeConfigDraft,
    patchSelectedNode,
    removeNode,
    selectedNode,
    selectedNodeId,
  }
}
