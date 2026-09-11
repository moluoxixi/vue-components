import type { PageGraph, PageNode } from '@moluoxixi/config-form-model'
import type { DesignerDragSource, DesignerRuntimeNodeGeometry } from '../src/components/DesignerCanvas/types'
import { describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import { useDesignerCanvasDropTargets } from '../src/components/DesignerCanvas/composables/use-designer-canvas-drop-targets'

const inputNode: PageNode = { id: 'input-1', kind: 'field', component: 'element.input', field: 'name', props: {}, events: {}, bindings: {} }
const sectionNode: PageNode = { id: 'sec-1', kind: 'layout', component: 'element.section', props: {}, events: {}, bindings: {}, slots: { default: [] } }
const candidate: PageNode = { id: 'cand-1', kind: 'field', component: 'element.input', field: 'cand_1', props: {}, events: {}, bindings: {} }

const graph: PageGraph = {
  version: 1,
  props: {},
  form: {} as never,
  root: [{ nodeId: 'input-1', placement: {} }, { nodeId: 'sec-1', placement: {} }],
  nodesById: { 'input-1': inputNode, 'sec-1': sectionNode },
} as never

const geometry: DesignerRuntimeNodeGeometry[] = [
  { nodeId: 'input-1', rect: { left: 100, top: 100, width: 400, height: 60, right: 500, bottom: 160 } },
  { nodeId: 'sec-1', rect: { left: 100, top: 180, width: 400, height: 36, right: 500, bottom: 216 } },
]

const registry = {
  getMaterial: (key: string) => key === 'element.section'
    ? { key, kind: 'layout', slots: [{ name: 'default', accepts: ['field', 'layout'] }] }
    : { key, kind: 'field', slots: [] },
} as never

function createHarness() {
  const sheet = document.createElement('div')
  sheet.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 800, width: 800, height: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  const scope = effectScope()
  const targets = scope.run(() => useDesignerCanvasDropTargets({
    activeSource: () => ({ type: 'material', materialKey: 'element.input', candidateId: 'cand-1' } satisfies DesignerDragSource),
    cameraViewportRef: ref<HTMLElement>(),
    candidateCommandForSource: (_source, target) => ({ id: 'preview', label: 'preview', actions: [{ type: 'operation.apply', operations: [{ type: 'node.insert', pageId: 'page', subgraph: { root: [], nodesById: {} }, target }] }] } as never),
    candidateNode: () => candidate,
    candidatePreview: command => ({ command, graph }),
    dragController: undefined,
    graph: () => graph,
    nodeForDragSource: () => candidate,
    onGeometryChange: () => {},
    registry: () => registry,
    runtimeNodeGeometry: () => geometry,
    sheetRef: ref(sheet),
  }))!
  return { scope, targets }
}

describe('drop targets over an empty section', () => {
  it('targets the empty section slot when the pointer rests at its center', () => {
    const { scope, targets } = createHarness()
    const source: DesignerDragSource = { type: 'material', materialKey: 'element.input', candidateId: 'cand-1' }
    const resolved = targets.resolveDropTarget({ x: 300, y: 198 }, source)
    scope.stop()
    expect(resolved).toEqual({ parentId: 'sec-1', slot: 'default', index: 0 })
  })

  it('targets the empty section slot across its full height band', () => {
    const { scope, targets } = createHarness()
    const source: DesignerDragSource = { type: 'material', materialKey: 'element.input', candidateId: 'cand-1' }
    const nearTop = targets.resolveDropTarget({ x: 300, y: 184 }, source)
    const nearBottom = targets.resolveDropTarget({ x: 300, y: 212 }, source)
    scope.stop()
    expect(nearTop).toEqual({ parentId: 'sec-1', slot: 'default', index: 0 })
    expect(nearBottom).toEqual({ parentId: 'sec-1', slot: 'default', index: 0 })
  })
})
