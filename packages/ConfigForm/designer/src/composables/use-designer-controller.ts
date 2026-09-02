import type {
  ModelDiagnostic,
  PageGraph,
  PageNode,
  ProjectCommand,
  ProjectCommandAction,
  ProjectOperation,
} from '@moluoxixi/config-form-model'
import type {
  DesignerDiagnostic,
  DesignerDropTarget,
  DesignNodeLocation,
} from '../graph'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../registry'
import type {
  DesignerController,
  DesignerSelectionMode,
  UseDesignerControllerOptions,
} from './types'
import { computed, ref, watch } from 'vue'
import {
  collectDesignSubtreeIds,
  createDesignerCommandId,
  createDesignerNodeId,
  createInsertCommand,
  createOperationCommand,
  createRemoveCommand,
  designerDiagnostic,
  findDesignNode,
  walkDesignGraph,
} from '../graph'
import { analyzeDesignGraph } from '../registry'

function uniqueField(graph: PageGraph, component: string): string {
  const used = new Set<string>()
  walkDesignGraph(graph, ({ node }) => {
    if (node.kind === 'field')
      used.add(node.field)
  })

  const fallback = component.split('.').at(-1)?.replace(/\W/g, '_') || 'field'
  if (!used.has(fallback))
    return fallback
  let suffix = 2
  while (used.has(`${fallback}_${suffix}`))
    suffix += 1
  return `${fallback}_${suffix}`
}

function targetForLocation(location: DesignNodeLocation, index: number): DesignerDropTarget {
  return location.parentId === null
    ? { parentId: null, index }
    : { parentId: location.parentId, slot: location.slot!, index }
}

function acceptsNode(
  registry: DesignerRegistry,
  material: DesignerMaterialDefinition | undefined,
  node: PageNode,
): string | undefined {
  if (material?.kind !== 'layout')
    return undefined
  return material.slots.find(slot => (!slot.accepts || slot.accepts.includes(node.kind))
    && (!slot.materials || slot.materials.includes(node.component))
    && (slot.max === undefined || slot.max > 0))?.name
}

function toDesignerDiagnostics(diagnostics: readonly ModelDiagnostic[]): DesignerDiagnostic[] {
  return diagnostics.map(diagnostic => ({
    code: diagnostic.code,
    message: diagnostic.message,
    path: [...(diagnostic.path ?? [])],
    severity: 'error',
    ...(diagnostic.nodeId ? { nodeId: diagnostic.nodeId } : {}),
    ...(diagnostic.pageId ? { pageId: diagnostic.pageId } : {}),
  }))
}

function defaultCopyField(sourceField: string, usedFields: ReadonlySet<string>): string {
  const base = `${sourceField}_copy`
  if (!usedFields.has(base))
    return base
  let suffix = 2
  while (usedFields.has(`${base}_${suffix}`))
    suffix += 1
  return `${base}_${suffix}`
}

export function useDesignerController(options: UseDesignerControllerOptions): DesignerController {
  const selectedId = ref<string>()
  const selectedIds = ref<string[]>([])
  const commandDiagnostics = ref<DesignerDiagnostic[]>([])
  const graph = computed(options.graph)
  const graphDiagnostics = computed(() => analyzeDesignGraph(graph.value, options.registry(), {
    includeDefaultDiagnostics: false,
    includeMaterialDiagnostics: false,
  }))
  const diagnostics = computed(() => commandDiagnostics.value.length > 0
    ? commandDiagnostics.value
    : graphDiagnostics.value)
  const selectedNode = computed(() => selectedId.value
    ? findDesignNode(graph.value, selectedId.value)?.node
    : undefined)
  const selectedNodes = computed(() => selectedIds.value
    .map(nodeId => findDesignNode(graph.value, nodeId)?.node)
    .filter((node): node is PageNode => Boolean(node)))
  const selectedMaterial = computed(() => selectedNode.value
    ? options.registry().getMaterial(selectedNode.value.component)
    : undefined)

  watch(diagnostics, value => options.onDiagnostics(value), { deep: true, immediate: true })
  watch(graph, nextGraph => pruneSelection(nextGraph))

  function rejectReadonly(): boolean {
    if (!options.readonly())
      return false
    commandDiagnostics.value = [designerDiagnostic(
      'DESIGNER_READONLY',
      'The designer is read-only',
    )]
    return true
  }

  function dispatch(command: ProjectCommand): boolean {
    if (rejectReadonly())
      return false
    const result = options.execute(command)
    commandDiagnostics.value = result.changed ? [] : toDesignerDiagnostics(result.diagnostics)
    return result.changed
  }

  function documentOrder(): string[] {
    const ids: string[] = []
    walkDesignGraph(graph.value, ({ node }) => ids.push(node.id))
    return ids
  }

  function emitSelection(nextIds: string[], primary?: string): void {
    if (selectedId.value === primary
      && nextIds.length === selectedIds.value.length
      && nextIds.every((id, index) => selectedIds.value[index] === id)) {
      return
    }
    selectedIds.value = nextIds
    selectedId.value = primary
    options.onSelectionChange(primary, [...nextIds])
  }

  function pruneSelection(nextGraph: PageGraph): void {
    const nextIds = selectedIds.value.filter(nodeId => findDesignNode(nextGraph, nodeId))
    const primary = selectedId.value && nextIds.includes(selectedId.value)
      ? selectedId.value
      : nextIds.at(-1)
    emitSelection(nextIds, primary)
  }

  function select(nodeId?: string, mode: DesignerSelectionMode = 'replace'): void {
    const next = nodeId && findDesignNode(graph.value, nodeId) ? nodeId : undefined
    if (!next) {
      emitSelection([], undefined)
      return
    }
    if (mode === 'toggle') {
      const included = selectedIds.value.includes(next)
      const nextIds = included
        ? selectedIds.value.filter(id => id !== next)
        : [...selectedIds.value, next]
      emitSelection(nextIds, included ? nextIds.at(-1) : next)
      return
    }
    if (mode === 'range' && selectedId.value) {
      const order = documentOrder()
      const start = order.indexOf(selectedId.value)
      const end = order.indexOf(next)
      if (start >= 0 && end >= 0) {
        const range = order.slice(Math.min(start, end), Math.max(start, end) + 1)
        emitSelection([...new Set([...selectedIds.value, ...range])], next)
        return
      }
    }
    emitSelection([next], next)
  }

  function topLevelSelectedIds(): string[] {
    const selected = new Set(selectedIds.value)
    return selectedIds.value.filter((nodeId) => {
      let parent = findDesignNode(graph.value, nodeId)?.parent
      while (parent) {
        if (selected.has(parent.id))
          return false
        parent = findDesignNode(graph.value, parent.id)?.parent
      }
      return true
    })
  }

  function actionLocations(nodeId: string): DesignNodeLocation[] {
    const nodeIds = selectedIds.value.includes(nodeId) ? topLevelSelectedIds() : [nodeId]
    return nodeIds
      .map(id => findDesignNode(graph.value, id))
      .filter((location): location is DesignNodeLocation => Boolean(location))
  }

  function groupLocations(locations: DesignNodeLocation[]): DesignNodeLocation[][] {
    const groups = new Map<string, DesignNodeLocation[]>()
    locations.forEach((location) => {
      const key = `${location.parentId ?? 'root'}:${location.slot ?? ''}`
      const group = groups.get(key)
      if (group)
        group.push(location)
      else
        groups.set(key, [location])
    })
    return [...groups.values()].map(group => group.sort((left, right) => left.index - right.index))
  }

  function createDuplicateActions(locations: DesignNodeLocation[]): {
    actions: ProjectCommandAction[]
    copiedIds: Map<string, string>
  } {
    const usedFields = new Set<string>()
    walkDesignGraph(graph.value, ({ node }) => {
      if (node.kind === 'field')
        usedFields.add(node.field)
    })
    const copiedIds = new Map<string, string>()
    const actions = locations.map((location): ProjectCommandAction => {
      const idMap: Record<string, string> = {}
      const fieldMap: Record<string, string> = {}
      collectDesignSubtreeIds(graph.value, location.node.id).forEach((sourceId) => {
        const source = graph.value.nodesById[sourceId]!
        const nextId = createDesignerNodeId(source.kind)
        idMap[sourceId] = nextId
        if (source.kind === 'field') {
          const nextField = defaultCopyField(source.field, usedFields)
          fieldMap[source.field] = nextField
          usedFields.add(nextField)
        }
      })
      copiedIds.set(location.node.id, idMap[location.node.id]!)
      return {
        type: 'node.duplicate',
        pageId: options.pageId(),
        nodeId: location.node.id,
        target: targetForLocation(location, location.index + 1),
        idMap,
        fieldMap,
      }
    })
    return { actions, copiedIds }
  }

  function copySelection(nodeId: string, locations: DesignNodeLocation[]): boolean {
    const order = documentOrder()
    const mutationOrder = [...locations].sort((left, right) => (
      left.parentId === right.parentId && left.slot === right.slot
        ? right.index - left.index
        : order.indexOf(right.node.id) - order.indexOf(left.node.id)
    ))
    const { actions, copiedIds } = createDuplicateActions(mutationOrder)
    const changed = dispatch({
      id: createDesignerCommandId('duplicate'),
      label: actions.length === 1 ? 'Duplicate component' : 'Duplicate components',
      actions,
    })
    if (changed) {
      const nextIds = locations.map(location => copiedIds.get(location.node.id)!).filter(Boolean)
      emitSelection(nextIds, copiedIds.get(nodeId) ?? nextIds.at(-1))
    }
    return changed
  }

  function moveSelection(
    action: 'moveBefore' | 'moveAfter' | 'indent' | 'outdent',
    locations: DesignNodeLocation[],
  ): boolean {
    const operations: ProjectOperation[] = []
    for (const group of groupLocations(locations)) {
      const first = group[0]!
      const last = group.at(-1)!
      if (action === 'moveBefore') {
        if (first.index === 0)
          return false
        group.forEach((location, offset) => operations.push({
          type: 'node.move',
          pageId: options.pageId(),
          nodeId: location.node.id,
          target: targetForLocation(location, first.index - 1 + offset),
        }))
        continue
      }
      if (action === 'moveAfter') {
        if (last.index === last.sequence.length - 1) {
          return false
        }
        ;[...group].reverse().forEach((location, offset) => operations.push({
          type: 'node.move',
          pageId: options.pageId(),
          nodeId: location.node.id,
          target: targetForLocation(location, last.index + 1 - offset),
        }))
        continue
      }
      if (action === 'indent') {
        const previousItem = first.sequence[first.index - 1]
        const previous = previousItem ? graph.value.nodesById[previousItem.nodeId] : undefined
        const material = previous ? options.registry().getMaterial(previous.component) : undefined
        const targetSlots = previous
          ? group.map(location => acceptsNode(options.registry(), material, location.node))
          : []
        const slot = targetSlots[0]
        if (previous?.kind !== 'layout' || !slot || targetSlots.some(candidate => candidate !== slot))
          return false
        group.forEach(location => operations.push({
          type: 'node.move',
          pageId: options.pageId(),
          nodeId: location.node.id,
          target: { parentId: previous.id, slot },
        }))
        continue
      }
      if (!first.parent)
        return false
      const parentLocation = findDesignNode(graph.value, first.parent.id)
      if (!parentLocation)
        return false
      group.forEach((location, offset) => operations.push({
        type: 'node.move',
        pageId: options.pageId(),
        nodeId: location.node.id,
        target: targetForLocation(parentLocation, parentLocation.index + 1 + offset),
      }))
    }
    return operations.length > 0 && dispatch(createOperationCommand('Move components', operations))
  }

  function defaultTarget(node: PageNode): DesignerDropTarget {
    const selected = selectedNode.value
    const material = selected ? options.registry().getMaterial(selected.component) : undefined
    const slot = acceptsNode(options.registry(), material, node)
    return selected?.kind === 'layout' && slot
      ? { parentId: selected.id, slot }
      : { parentId: null }
  }

  function addMaterial(component: string, target?: DesignerDropTarget): boolean {
    if (rejectReadonly())
      return false
    const material = options.registry().getMaterial(component)
    if (!material) {
      commandDiagnostics.value = [designerDiagnostic(
        'DESIGNER_MATERIAL_UNKNOWN',
        `Unknown designer component: ${component}`,
      )]
      return false
    }
    const id = createDesignerNodeId(material.kind)
    let subgraph
    try {
      subgraph = options.registry().createSubgraph(component, {
        id,
        ...(material.kind === 'field' ? { field: uniqueField(graph.value, component) } : {}),
      })
    }
    catch (error) {
      commandDiagnostics.value = [designerDiagnostic(
        'DESIGNER_MATERIAL_FACTORY_FAILED',
        error instanceof Error ? error.message : `Designer material factory failed: ${component}`,
      )]
      return false
    }
    const root = subgraph.root[0]
    const node = root ? subgraph.nodesById[root.nodeId] : undefined
    if (!node)
      return false
    const changed = dispatch(createInsertCommand(
      options.pageId(),
      subgraph,
      target ?? defaultTarget(node),
    ))
    if (changed)
      emitSelection([id], id)
    return changed
  }

  function performNodeAction(
    action: 'moveBefore' | 'moveAfter' | 'indent' | 'outdent' | 'copy' | 'remove',
    nodeId: string,
  ): boolean {
    const locations = actionLocations(nodeId)
    const location = locations.find(candidate => candidate.node.id === nodeId) ?? locations[0]
    if (!location)
      return false
    if (action === 'remove')
      return dispatch(createRemoveCommand(options.pageId(), locations.map(({ node }) => node.id)))
    return action === 'copy'
      ? copySelection(nodeId, locations)
      : moveSelection(action, locations)
  }

  return {
    diagnostics,
    dispatch,
    graph,
    selectedId,
    selectedIds,
    selectedMaterial,
    selectedNode,
    selectedNodes,
    select,
    addMaterial,
    performNodeAction,
  }
}
