import type { ComputedRef, Ref } from 'vue'
import type { DesignerCompileResult } from '../compiler'
import type { DesignerDiagnostic, DesignerDocument, DesignerNode } from '../document'
import type {
  DesignerCommand,
  DesignerDropTarget,
  DesignerHistoryState,
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
  resetDesignerHistory,
  undoDesignerHistory,
} from '../history'
import { analyzeDesignerDocument } from '../registry'

interface UseDesignerControllerOptions {
  document: () => DesignerDocument
  registry: () => DesignerRegistry
  historyLimit: () => number
  readonly: () => boolean
  onDocumentChange: (document: DesignerDocument) => void
  onCommand: (command: DesignerCommand, document: DesignerDocument) => void
  onDiagnostics: (diagnostics: DesignerDiagnostic[]) => void
  onSelectionChange: (nodeId: string | undefined) => void
}

export interface DesignerController {
  history: Ref<DesignerHistoryState>
  document: ComputedRef<DesignerDocument>
  selectedId: Ref<string | undefined>
  selectedNode: ComputedRef<DesignerNode | undefined>
  selectedMaterial: ComputedRef<DesignerMaterialDefinition | undefined>
  diagnostics: ComputedRef<DesignerDiagnostic[]>
  compileResult: ComputedRef<DesignerCompileResult>
  renderVersion: Ref<number>
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  dispatch: (command: DesignerCommand) => boolean
  undo: () => boolean
  redo: () => boolean
  select: (nodeId?: string) => void
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
  const history = shallowRef(createDesignerHistory(initial.document, normalizeHistoryLimit(options.historyLimit())))
  const selectedId = ref<string>()
  const commandDiagnostics = ref<DesignerDiagnostic[]>(
    hasDesignerErrors(initial.diagnostics) ? initial.diagnostics : [],
  )
  const renderVersion = ref(0)
  const document = computed(() => history.value.present)
  const compileResult = computed(() => compileDesignerDocument(document.value, options.registry()))
  const diagnostics = computed(() => commandDiagnostics.value.length > 0
    ? commandDiagnostics.value
    : compileResult.value.diagnostics)
  const selectedNode = computed(() => selectedId.value
    ? findDesignerNode(document.value, selectedId.value)?.node
    : undefined)
  const selectedMaterial = computed(() => selectedNode.value
    ? options.registry().getMaterial(selectedNode.value.material)
    : undefined)
  const canUndo = computed(() => !options.readonly() && history.value.past.length > 0)
  const canRedo = computed(() => !options.readonly() && history.value.future.length > 0)

  watch(diagnostics, value => options.onDiagnostics(value), { deep: true, immediate: true })
  watch(options.document, (value) => {
    if (areDesignerJsonValuesEqual(value, document.value))
      return
    const next = initialState(value, options.registry())
    commandDiagnostics.value = hasDesignerErrors(next.diagnostics) ? next.diagnostics : []
    if (hasDesignerErrors(next.diagnostics))
      return
    history.value = resetDesignerHistory(history.value, next.document)
    if (selectedId.value && !findDesignerNode(next.document, selectedId.value))
      select()
    renderVersion.value += 1
  }, { deep: true })
  watch(options.historyLimit, (limit) => {
    if (!Number.isInteger(limit) || limit < 1)
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
    const result = applyDesignerCommand(history.value, command, options.registry())
    commandDiagnostics.value = result.changed ? [] : result.diagnostics
    renderVersion.value += 1
    if (!result.changed)
      return false
    history.value = result.history
    if (selectedId.value && !findDesignerNode(document.value, selectedId.value))
      select()
    emitDocument(command)
    return true
  }

  function applyHistory(next: ReturnType<typeof undoDesignerHistory>): boolean {
    commandDiagnostics.value = next.changed ? [] : next.diagnostics
    renderVersion.value += 1
    if (!next.changed)
      return false
    history.value = next.history
    if (selectedId.value && !findDesignerNode(document.value, selectedId.value))
      select()
    emitDocument()
    return true
  }

  function undo(): boolean {
    return options.readonly() ? false : applyHistory(undoDesignerHistory(history.value))
  }

  function redo(): boolean {
    return options.readonly() ? false : applyHistory(redoDesignerHistory(history.value))
  }

  function select(nodeId?: string): void {
    const next = nodeId && findDesignerNode(document.value, nodeId) ? nodeId : undefined
    if (selectedId.value === next)
      return
    selectedId.value = next
    options.onSelectionChange(next)
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
    if (changed)
      select(id)
    return changed
  }

  function performNodeAction(
    action: 'moveBefore' | 'moveAfter' | 'indent' | 'outdent' | 'copy' | 'remove',
    nodeId: string,
  ): boolean {
    const location = findDesignerNode(document.value, nodeId)
    if (!location)
      return false
    if (action === 'remove')
      return dispatch({ type: 'removeNode', nodeId })
    if (action === 'copy') {
      const target = targetForLocation(document.value, nodeId, location.index + 1)
      if (!target)
        return false
      const command = createDesignerCopyCommand(document.value, nodeId, target)
      const changed = dispatch(command)
      if (changed)
        select(command.newIds[nodeId])
      return changed
    }
    if (action === 'moveBefore') {
      const target = targetForLocation(document.value, nodeId, location.index - 1)
      return location.index > 0 && target ? dispatch({ type: 'moveNode', nodeId, target }) : false
    }
    if (action === 'moveAfter') {
      const target = targetForLocation(document.value, nodeId, location.index + 1)
      return location.index < location.nodes.length - 1 && target
        ? dispatch({ type: 'moveNode', nodeId, target })
        : false
    }
    if (action === 'indent') {
      const previous = location.nodes[location.index - 1]
      const material = previous ? options.registry().getMaterial(previous.material) : undefined
      const slot = previous && material ? acceptsNode(material, location.node) : undefined
      return previous?.kind === 'container' && slot
        ? dispatch({ type: 'moveNode', nodeId, target: { parentId: previous.id, slot } })
        : false
    }
    if (!location.parent)
      return false
    const parentLocation = findDesignerNode(document.value, location.parent.id)
    if (!parentLocation)
      return false
    const target = parentLocation.parent && parentLocation.slot
      ? { parentId: parentLocation.parent.id, slot: parentLocation.slot, index: parentLocation.index + 1 }
      : { parentId: null, index: parentLocation.index + 1 }
    return dispatch({ type: 'moveNode', nodeId, target })
  }

  function preview(): DesignerCompileResult {
    const result = compileDesignerDocument(document.value, options.registry())
    commandDiagnostics.value = []
    return result
  }

  function importDocument(input: unknown): boolean {
    if (rejectReadonly())
      return false
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
    selectedNode,
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
