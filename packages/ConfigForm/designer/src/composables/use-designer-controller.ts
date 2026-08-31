import type { ComputedRef, Ref } from 'vue'
import type { DesignerCompileResult } from '../compiler'
import type { DesignerDiagnostic, DesignerDocument, DesignerNode } from '../document'
import type {
  DesignerCommand,
  DesignerDropTarget,
  DesignerHistoryState,
  DesignerNodeLocation,
} from '../history'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../registry'
import { computed, ref, shallowRef, watch } from 'vue'
import { compileDesignerDocument } from '../compiler'
import {
  areDesignerJsonValuesEqual,
  cloneDesignerDocument,
  DESIGNER_DOCUMENT_VERSION,
  DESIGNER_HISTORY_LIMIT,
  designerDiagnostic,
  hasDesignerErrors,
  parseDesignerDocument,
} from '../document'
import {
  applyDesignerCommand,
  createDesignerCopyCommand,
  createDesignerHistory,
  createDesignerNodeId,
  findDesignerNode,
  redoDesignerHistory,
  reduceDesignerCommand,
  resetDesignerHistory,
  undoDesignerHistory,
} from '../history'
import { analyzeDesignerDocument } from '../registry'

interface UseDesignerControllerOptions {
  document: () => DesignerDocument
  registry: () => DesignerRegistry
  historyLimit: () => number
  readonly: () => boolean
  controlled: () => boolean
  onBeforeCommandCommit: (command: DesignerCommand, document: DesignerDocument) => boolean
  onDocumentChange: (document: DesignerDocument) => void
  onCommand: (command: DesignerCommand, document: DesignerDocument) => void
  onDiagnostics: (diagnostics: DesignerDiagnostic[]) => void
  onSelectionChange: (nodeId: string | undefined, nodeIds: string[]) => void
}

export type DesignerSelectionMode = 'range' | 'replace' | 'toggle'

export interface DesignerController {
  /**
   * Local history is available only for the standalone, uncontrolled designer.
   * The Workbench passes a controlled document and owns history in its
   * ProjectEditorSession, so exposing a local history there would create a
   * second source of truth.
   */
  history?: Ref<DesignerHistoryState>
  document: ComputedRef<DesignerDocument>
  selectedId: Ref<string | undefined>
  selectedIds: Ref<string[]>
  selectedNode: ComputedRef<DesignerNode | undefined>
  selectedNodes: ComputedRef<DesignerNode[]>
  selectedMaterial: ComputedRef<DesignerMaterialDefinition | undefined>
  diagnostics: ComputedRef<DesignerDiagnostic[]>
  compileResult: ComputedRef<DesignerCompileResult>
  renderVersion: Ref<number>
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  dispatch: (command: DesignerCommand) => boolean
  undo: () => boolean
  redo: () => boolean
  select: (nodeId?: string, mode?: DesignerSelectionMode) => void
  addMaterial: (materialKey: string, target?: DesignerDropTarget) => boolean
  performNodeAction: (action: 'moveBefore' | 'moveAfter' | 'indent' | 'outdent' | 'copy' | 'remove', nodeId: string) => boolean
  preview: () => DesignerCompileResult
  importDocument: (input: unknown) => boolean
  exportDocument: () => string
}

function emptyDocument(): DesignerDocument {
  return { version: DESIGNER_DOCUMENT_VERSION, form: {}, nodes: [] }
}

function normalizeHistoryLimit(limit: number): number {
  return Number.isInteger(limit) && limit > 0 ? limit : DESIGNER_HISTORY_LIMIT
}

function initialState(input: unknown, registry: DesignerRegistry): {
  document: DesignerDocument
  diagnostics: DesignerDiagnostic[]
} {
  const parsed = parseDesignerDocument(input)
  if (!parsed.success)
    return { document: emptyDocument(), diagnostics: parsed.diagnostics }
  const diagnostics = analyzeDesignerDocument(parsed.data, registry, {
    includeDefaultDiagnostics: false,
    includeMaterialDiagnostics: false,
  })
  return hasDesignerErrors(diagnostics)
    ? { document: emptyDocument(), diagnostics }
    : { document: parsed.data, diagnostics }
}

function uniqueField(document: DesignerDocument, materialKey: string): string {
  const used = new Set<string>()
  const visit = (nodes: DesignerNode[]): void => {
    for (const node of nodes) {
      if (node.kind === 'field')
        used.add(node.field)
      else
        Object.values(node.slots).forEach(visit)
    }
  }
  visit(document.nodes)

  const fallback = materialKey.split('.').at(-1)?.replace(/\W/g, '_') || 'field'
  if (!used.has(fallback))
    return fallback
  let suffix = 2
  while (used.has(`${fallback}_${suffix}`))
    suffix += 1
  return `${fallback}_${suffix}`
}

function targetForLocation(document: DesignerDocument, nodeId: string, index: number): DesignerDropTarget | undefined {
  const location = findDesignerNode(document, nodeId)
  if (!location)
    return undefined
  return location.parent && location.slot
    ? { parentId: location.parent.id, slot: location.slot, index }
    : { parentId: null, index }
}

function acceptsNode(material: DesignerMaterialDefinition, node: DesignerNode): string | undefined {
  if (material.kind !== 'container')
    return undefined
  return material.slots.find(slot => (!slot.accepts || slot.accepts.includes(node.kind))
    && (!slot.materials || slot.materials.includes(node.material)))?.name
}

export function useDesignerController(options: UseDesignerControllerOptions): DesignerController {
  const initial = initialState(options.document(), options.registry())
  const history = options.controlled()
    ? undefined
    : shallowRef(createDesignerHistory(initial.document, normalizeHistoryLimit(options.historyLimit())))
  const selectedId = ref<string>()
  const selectedIds = ref<string[]>([])
  const commandDiagnostics = ref<DesignerDiagnostic[]>(
    hasDesignerErrors(initial.diagnostics) ? initial.diagnostics : [],
  )
  const renderVersion = ref(0)
  const document = computed(() => options.controlled()
    ? options.document()
    : history!.value.present)
  const compileResult = computed(() => compileDesignerDocument(document.value, options.registry()))
  const diagnostics = computed(() => commandDiagnostics.value.length > 0
    ? commandDiagnostics.value
    : compileResult.value.diagnostics)
  const selectedNode = computed(() => selectedId.value
    ? findDesignerNode(document.value, selectedId.value)?.node
    : undefined)
  const selectedNodes = computed(() => selectedIds.value
    .map(nodeId => findDesignerNode(document.value, nodeId)?.node)
    .filter((node): node is DesignerNode => Boolean(node)))
  const selectedMaterial = computed(() => selectedNode.value
    ? options.registry().getMaterial(selectedNode.value.material)
    : undefined)
  const canUndo = computed(() => !options.controlled()
    && !options.readonly()
    && (history?.value.past.length ?? 0) > 0)
  const canRedo = computed(() => !options.controlled()
    && !options.readonly()
    && (history?.value.future.length ?? 0) > 0)

  watch(diagnostics, value => options.onDiagnostics(value), { deep: true, immediate: true })
  watch(options.document, (value) => {
    const next = initialState(value, options.registry())
    commandDiagnostics.value = hasDesignerErrors(next.diagnostics) ? next.diagnostics : []
    if (hasDesignerErrors(next.diagnostics))
      return
    if (options.controlled()) {
      pruneSelection(next.document)
      renderVersion.value += 1
      return
    }
    if (areDesignerJsonValuesEqual(value, document.value))
      return
    if (!history)
      return
    history.value = resetDesignerHistory(history.value, next.document)
    pruneSelection(next.document)
    renderVersion.value += 1
  }, { deep: true })
  watch(options.historyLimit, (limit) => {
    if (!history || !Number.isInteger(limit) || limit < 1)
      return
    history.value = {
      ...history.value,
      past: history.value.past.slice(-limit),
      future: history.value.future.slice(0, limit),
      limit,
    }
  })

  function emitDocument(command?: DesignerCommand): void {
    const next = cloneDesignerDocument(document.value)
    options.onDocumentChange(next)
    if (command)
      options.onCommand(command, next)
  }

  function rejectReadonly(): boolean {
    if (!options.readonly())
      return false
    commandDiagnostics.value = [designerDiagnostic(
      'DESIGNER_READONLY',
      'The designer is read-only',
      [],
    )]
    return true
  }

  function dispatch(command: DesignerCommand): boolean {
    if (rejectReadonly())
      return false
    if (options.controlled()) {
      const result = reduceDesignerCommand(document.value, command, options.registry())
      commandDiagnostics.value = result.changed ? [] : result.diagnostics
      renderVersion.value += 1
      if (!result.changed)
        return false
      const nextDocument = cloneDesignerDocument(result.document)
      if (!options.onBeforeCommandCommit(command, nextDocument))
        return false
      pruneSelection(nextDocument)
      options.onCommand(command, nextDocument)
      return true
    }
    if (!history)
      return false
    const result = applyDesignerCommand(history.value, command, options.registry())
    commandDiagnostics.value = result.changed ? [] : result.diagnostics
    renderVersion.value += 1
    if (!result.changed)
      return false
    const nextDocument = cloneDesignerDocument(result.history.present)
    if (!options.onBeforeCommandCommit(command, nextDocument))
      return false
    history.value = result.history
    pruneSelection(nextDocument)
    emitDocument(command)
    return true
  }

  function applyHistory(next: ReturnType<typeof undoDesignerHistory>): boolean {
    commandDiagnostics.value = next.changed ? [] : next.diagnostics
    renderVersion.value += 1
    if (!next.changed)
      return false
    if (!history)
      return false
    history.value = next.history
    pruneSelection(document.value)
    emitDocument()
    return true
  }

  function undo(): boolean {
    if (options.controlled() || options.readonly() || !history)
      return false
    return applyHistory(undoDesignerHistory(history.value))
  }

  function redo(): boolean {
    if (options.controlled() || options.readonly() || !history)
      return false
    return applyHistory(redoDesignerHistory(history.value))
  }

  function documentOrder(): string[] {
    const ids: string[] = []
    const visit = (nodes: DesignerNode[]): void => {
      for (const node of nodes) {
        ids.push(node.id)
        if (node.kind === 'container')
          Object.values(node.slots).forEach(visit)
      }
    }
    visit(document.value.nodes)
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

  function pruneSelection(nextDocument: DesignerDocument): void {
    const nextIds = selectedIds.value.filter(nodeId => findDesignerNode(nextDocument, nodeId))
    const primary = selectedId.value && nextIds.includes(selectedId.value)
      ? selectedId.value
      : nextIds.at(-1)
    emitSelection(nextIds, primary)
  }

  function select(nodeId?: string, mode: DesignerSelectionMode = 'replace'): void {
    const next = nodeId && findDesignerNode(document.value, nodeId) ? nodeId : undefined
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
      let parent = findDesignerNode(document.value, nodeId)?.parent
      while (parent) {
        if (selected.has(parent.id))
          return false
        parent = findDesignerNode(document.value, parent.id)?.parent
      }
      return true
    })
  }

  function actionLocations(nodeId: string): DesignerNodeLocation[] {
    const nodeIds = selectedIds.value.includes(nodeId) ? topLevelSelectedIds() : [nodeId]
    return nodeIds
      .map(id => findDesignerNode(document.value, id))
      .filter((location): location is DesignerNodeLocation => Boolean(location))
  }

  function groupLocations(locations: DesignerNodeLocation[]): DesignerNodeLocation[][] {
    const groups: DesignerNodeLocation[][] = []
    for (const location of locations) {
      const group = groups.find(entries => entries[0]?.nodes === location.nodes)
      if (group)
        group.push(location)
      else
        groups.push([location])
    }
    groups.forEach(group => group.sort((left, right) => left.index - right.index))
    return groups
  }

  function dispatchActionCommands(commands: DesignerCommand[]): boolean {
    if (commands.length === 0)
      return false
    return dispatch(commands.length === 1 ? commands[0]! : { type: 'batch', commands })
  }

  function copySelection(nodeId: string, locations: DesignerNodeLocation[]): boolean {
    const order = documentOrder()
    const mutationOrder = [...locations].sort((left, right) => left.nodes === right.nodes
      ? right.index - left.index
      : order.indexOf(right.node.id) - order.indexOf(left.node.id))
    const commands = mutationOrder.map(location => createDesignerCopyCommand(
      document.value,
      location.node.id,
      targetForLocation(document.value, location.node.id, location.index + 1)!,
    ))
    const copiedIds = new Map(commands.map(command => [command.nodeId, command.newIds[command.nodeId]!]))
    const changed = dispatchActionCommands(commands)
    if (changed) {
      const nextIds = locations.map(location => copiedIds.get(location.node.id)!).filter(Boolean)
      emitSelection(nextIds, copiedIds.get(nodeId) ?? nextIds.at(-1))
    }
    return changed
  }

  function moveSelection(
    action: 'moveBefore' | 'moveAfter' | 'indent' | 'outdent',
    locations: DesignerNodeLocation[],
  ): boolean {
    const commands: DesignerCommand[] = []
    for (const group of groupLocations(locations)) {
      const first = group[0]!
      const last = group.at(-1)!
      if (action === 'moveBefore') {
        if (first.index === 0)
          return false
        group.forEach((location, offset) => commands.push({
          type: 'moveNode',
          nodeId: location.node.id,
          target: targetForLocation(document.value, location.node.id, first.index - 1 + offset)!,
        }))
        continue
      }
      if (action === 'moveAfter') {
        if (last.index === last.nodes.length - 1) {
          return false
        }
        ;[...group].reverse().forEach((location, offset) => commands.push({
          type: 'moveNode',
          nodeId: location.node.id,
          target: targetForLocation(document.value, location.node.id, last.index + 1 - offset)!,
        }))
        continue
      }
      if (action === 'indent') {
        const previous = first.nodes[first.index - 1]
        const material = previous ? options.registry().getMaterial(previous.material) : undefined
        const slots = material ? group.map(location => acceptsNode(material, location.node)) : []
        const slot = slots[0]
        if (previous?.kind !== 'container' || !slot || slots.some(candidate => candidate !== slot))
          return false
        group.forEach(location => commands.push({
          type: 'moveNode',
          nodeId: location.node.id,
          target: { parentId: previous.id, slot },
        }))
        continue
      }
      if (!first.parent)
        return false
      const parentLocation = findDesignerNode(document.value, first.parent.id)
      if (!parentLocation)
        return false
      group.forEach((location, offset) => commands.push({
        type: 'moveNode',
        nodeId: location.node.id,
        target: parentLocation.parent && parentLocation.slot
          ? { parentId: parentLocation.parent.id, slot: parentLocation.slot, index: parentLocation.index + 1 + offset }
          : { parentId: null, index: parentLocation.index + 1 + offset },
      }))
    }
    return dispatchActionCommands(commands)
  }

  function defaultTarget(node: DesignerNode): DesignerDropTarget {
    const selected = selectedNode.value
    const material = selected ? options.registry().getMaterial(selected.material) : undefined
    const slot = material ? acceptsNode(material, node) : undefined
    return selected?.kind === 'container' && slot
      ? { parentId: selected.id, slot }
      : { parentId: null }
  }

  function addMaterial(materialKey: string, target?: DesignerDropTarget): boolean {
    if (rejectReadonly())
      return false
    const material = options.registry().getMaterial(materialKey)
    if (!material) {
      commandDiagnostics.value = [designerDiagnostic(
        'DESIGNER_MATERIAL_UNKNOWN',
        `Unknown designer material: ${materialKey}`,
        [],
      )]
      return false
    }
    const id = createDesignerNodeId(material.kind)
    let node: DesignerNode
    try {
      node = options.registry().createNode(materialKey, {
        id,
        ...(material.kind === 'field' ? { field: uniqueField(document.value, materialKey) } : {}),
      })
    }
    catch (error) {
      commandDiagnostics.value = [designerDiagnostic(
        'DESIGNER_MATERIAL_FACTORY_FAILED',
        error instanceof Error ? error.message : `Designer material factory failed: ${materialKey}`,
        [],
      )]
      return false
    }
    const changed = dispatch({ type: 'addNode', node, target: target ?? defaultTarget(node) })
    if (changed) {
      if (options.controlled())
        emitSelection([id], id)
      else
        select(id)
    }
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
    if (action === 'remove') {
      return dispatchActionCommands(locations.map(({ node }) => ({ type: 'removeNode', nodeId: node.id })))
    }
    return action === 'copy'
      ? copySelection(nodeId, locations)
      : moveSelection(action, locations)
  }

  function preview(): DesignerCompileResult {
    const result = compileDesignerDocument(document.value, options.registry())
    commandDiagnostics.value = []
    return result
  }

  function importDocument(input: unknown): boolean {
    if (rejectReadonly())
      return false
    if (options.controlled()) {
      commandDiagnostics.value = [designerDiagnostic(
        'DESIGNER_CONTROLLED_IMPORT_UNSUPPORTED',
        'Document replacement is only available through the model migration boundary',
        [],
      )]
      return false
    }
    const parsed = parseDesignerDocument(input)
    if (!parsed.success) {
      commandDiagnostics.value = parsed.diagnostics
      return false
    }
    const semanticDiagnostics = analyzeDesignerDocument(parsed.data, options.registry(), {
      includeDefaultDiagnostics: false,
      includeMaterialDiagnostics: false,
    })
    commandDiagnostics.value = hasDesignerErrors(semanticDiagnostics) ? semanticDiagnostics : []
    if (hasDesignerErrors(semanticDiagnostics))
      return false
    if (!history)
      return false
    history.value = resetDesignerHistory(history.value, parsed.data)
    select()
    renderVersion.value += 1
    const next = cloneDesignerDocument(parsed.data)
    options.onDocumentChange(next)
    return true
  }

  function exportDocument(): string {
    const result = compileDesignerDocument(document.value, options.registry())
    commandDiagnostics.value = []
    if (!result.success)
      return ''
    return JSON.stringify(document.value, null, 2)
  }

  return {
    history,
    document,
    selectedId,
    selectedIds,
    selectedNode,
    selectedNodes,
    selectedMaterial,
    diagnostics,
    compileResult,
    renderVersion,
    canUndo,
    canRedo,
    dispatch,
    undo,
    redo,
    select,
    addMaterial,
    performNodeAction,
    preview,
    importDocument,
    exportDocument,
  }
}
