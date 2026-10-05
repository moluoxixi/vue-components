import type { ProjectCommand, SurfaceGraph, SurfaceNode } from '@moluoxixi/config-form-model'
import type { DesignerRuntimeNodeGeometry } from '../src/components/DesignerCanvas/types'
import type { DesignCommandPreview } from '../src/graph'
import { SURFACE_GRAPH_VERSION } from '@moluoxixi/config-form-model'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { useDesignerCanvasDropTargets } from '../src/components/DesignerCanvas/composables/use-designer-canvas-drop-targets'
import { createDesignerDragController, resolveDesignerCollapsedDropTarget } from '../src/components/DesignerCanvas/services'
import { createDesignerRegistry } from '../src/registry'

const registry = createDesignerRegistry({ materials: [{
  key: 'test.input',
  version: 1,
  kind: 'field',
  category: 'Fields',
  title: 'Input',
  runtime: { component: 'input' },
  setters: [],
  createNode: ({ id, field = id }) => ({ id, field, kind: 'field', component: 'test.input' }),
}, {
  key: 'test.section',
  version: 1,
  kind: 'layout',
  category: 'Layout',
  title: 'Section',
  runtime: { component: 'section' },
  setters: [],
  slots: [{ name: 'default', title: 'Content', accepts: ['field', 'layout'] }],
  createNode: ({ id }) => ({ id, kind: 'layout', component: 'test.section', slots: { default: [] } }),
}] })
const performanceBudgetMultiplier = Number(process.env.CI_PERFORMANCE_BUDGET_MULTIPLIER ?? 1)
const source = { type: 'material', materialKey: 'test.input', candidateId: 'candidate' } as const
const candidate: SurfaceNode = { id: 'candidate', kind: 'field', component: 'test.input', field: 'candidate', props: {} }

function harness(nodeCount: number, layouts = false) {
  let reads = 0
  const nodesById: SurfaceGraph['nodesById'] = {}
  const geometry: DesignerRuntimeNodeGeometry[] = []
  const root = Array.from({ length: nodeCount }, (_, index) => {
    const id = `node-${index}`
    nodesById[id] = layouts
      ? { id, kind: 'layout', component: 'test.section', props: {}, slots: { default: [] } }
      : { id, kind: 'field', component: 'test.input', field: id, props: {} }
    geometry.push({ nodeId: id, depth: 2, order: index, path: `root.${index}`, rect: { left: 0, right: 400, top: index * 40, bottom: index * 40 + 40, width: 400, height: 40 } })
    return { nodeId: id, placement: {} }
  })
  const graph: SurfaceGraph = { version: SURFACE_GRAPH_VERSION, props: {}, form: {}, root, nodesById: new Proxy(nodesById, {
    get(target, key, receiver) {
      reads += 1
      return Reflect.get(target, key, receiver)
    },
  }) }
  const sheet = document.createElement('div')
  sheet.getBoundingClientRect = () => new DOMRect(0, 0, 400, nodeCount * 40)
  const preview = vi.fn<(command: ProjectCommand) => DesignCommandPreview | undefined>(command => ({ command, graph }))
  let targets!: ReturnType<typeof useDesignerCanvasDropTargets>
  const wrapper = mount(defineComponent({ setup() {
    targets = useDesignerCanvasDropTargets({
      activeSource: () => source,
      cameraViewportRef: ref<HTMLElement>(),
      candidateCommandForSource: () => ({ id: 'candidate', label: 'Candidate', actions: [] }),
      candidateNode: () => candidate,
      candidatePreview: preview,
      dragController: undefined,
      graph: () => graph,
      nodeForDragSource: () => candidate,
      onGeometryChange: () => {},
      registry: () => registry,
      runtimeNodeGeometry: () => geometry,
      sheetRef: ref(sheet),
    })
    return () => null
  } }))
  return { graph, geometry, preview, targets, wrapper, reads: () => reads, reset: () => {
    reads = 0
    preview.mockClear()
  } }
}

describe('canvas drop target work at production graph sizes', () => {
  it.each([100, 500, 2000])('validates only the chosen keyboard destination among %i nodes', (nodeCount) => {
    const h = harness(nodeCount)
    const controller = createDesignerDragController({ commitMaterial: vi.fn(), commitNode: vi.fn() })
    controller.registerKeyboardTargets(h.targets.keyboardDropTargets, h.targets.isValidTarget)
    try {
      expect(controller.beginMaterialKeyboard(source.materialKey, source.candidateId)).toBe(true)
      expect(h.preview).toHaveBeenCalledTimes(1)
      expect(controller.moveKeyboard('next')).toBe(true)
      expect(h.preview).toHaveBeenCalledTimes(2)
      expect(controller.session.value?.target).toEqual({ parentId: null, index: 1 })
      expect(controller.moveKeyboard('previous')).toBe(true)
      expect(h.preview).toHaveBeenCalledTimes(3)
      expect(controller.session.value?.target).toEqual({ parentId: null, index: 0 })
    }
    finally {
      controller.cancel()
      h.wrapper.unmount()
    }
  })

  it('skips invalid keyboard destinations, wraps in both directions and retains the target on rejection', () => {
    const targets = Array.from({ length: 5 }, (_, index) => ({ parentId: null, index }))
    let accepted = [1, 3]
    const validate = vi.fn(target => accepted.includes(target.index))
    const controller = createDesignerDragController({ commitMaterial: vi.fn(), commitNode: vi.fn() })
    const unregister = controller.registerKeyboardTargets(() => targets, validate)
    expect(controller.beginNodeKeyboard('node')).toBe(true)
    expect(controller.session.value?.target?.index).toBe(1)
    expect(validate).toHaveBeenCalledTimes(2)
    expect(controller.moveKeyboard('next')).toBe(true)
    expect(controller.session.value?.target?.index).toBe(3)
    expect(controller.moveKeyboard('next')).toBe(true)
    expect(controller.session.value?.target?.index).toBe(1)
    expect(controller.moveKeyboard('previous')).toBe(true)
    expect(controller.session.value?.target?.index).toBe(3)
    accepted = []
    expect(controller.moveKeyboard('previous')).toBe(false)
    expect(controller.session.value?.target?.index).toBe(3)
    controller.cancel()
    expect(controller.beginNodeKeyboard('node')).toBe(false)
    expect(controller.session.value).toBeUndefined()
    unregister()
    expect(controller.beginNodeKeyboard('node')).toBe(false)
  })

  it('validates collapsed targets only after geometry filtering and falls back from a rejected inner slot', () => {
    const rect = { left: 0, right: 400, top: 100, bottom: 100, width: 400, height: 0 }
    const outer = { parentId: 'outer', slot: 'default', index: 0 }
    const inner = { parentId: 'inner', slot: 'default', index: 0 }
    const validate = vi.fn(target => target.parentId !== 'inner')
    expect(resolveDesignerCollapsedDropTarget({ x: 200, y: 100 }, [
      { depth: 4, specificity: 0, rect, target: inner },
      { depth: 2, specificity: 0, rect, target: outer },
      { depth: 6, specificity: 1, rect: { ...rect, top: 200, bottom: 200 }, target: inner },
      { depth: 6, specificity: 1, rect: { ...rect, height: 40, bottom: 140 }, target: inner },
    ], undefined, validate)).toEqual(outer)
    expect(validate).toHaveBeenCalledTimes(2)
    expect(validate).toHaveBeenNthCalledWith(1, inner)
    expect(validate).toHaveBeenNthCalledWith(2, outer)
  })

  it.each([100, 500, 2000])('resolves %i nodes with linear graph reads and one candidate validation', (nodeCount) => {
    const h = harness(nodeCount)
    const index = Math.floor(nodeCount / 2)
    try {
      expect(h.targets.resolveDropTarget({ x: 200, y: index * 40 + 30 }, source)).toEqual({ parentId: null, index: index + 1 })
      expect(h.reads()).toBeLessThanOrEqual(nodeCount * 3)
      expect(h.preview).toHaveBeenCalledTimes(1)
      const durations: number[] = []
      for (let sample = 0; sample < 25; sample += 1) {
        const started = performance.now()
        h.targets.resolveDropTarget({ x: 200, y: index * 40 + 30 }, source)
        if (sample >= 5)
          durations.push(performance.now() - started)
      }
      durations.sort((a, b) => a - b)
      const p95 = durations[Math.ceil(durations.length * 0.95) - 1]!
      expect(p95).toBeLessThan(16.7 * performanceBudgetMultiplier)
    }
    finally { h.wrapper.unmount() }
  })

  it('does not compile candidates for off-pointer or non-collapsed layouts', () => {
    const h = harness(500, true)
    try {
      expect(h.targets.resolveDropTarget({ x: 200, y: 10020 }, source)).toEqual({ parentId: 'node-250', slot: 'default', index: 0 })
      expect(h.preview).toHaveBeenCalledTimes(1)
    }
    finally { h.wrapper.unmount() }
  })

  it('rebuilds its index after in-place root reordering', () => {
    const h = harness(4)
    try {
      expect(h.targets.resolveDropTarget({ x: 200, y: 30 }, source)).toEqual({ parentId: null, index: 1 })
      h.graph.root.reverse()
      h.reset()
      expect(h.targets.resolveDropTarget({ x: 200, y: 30 }, source)).toEqual({ parentId: null, index: 4 })
      expect(h.reads()).toBeLessThanOrEqual(12)
    }
    finally { h.wrapper.unmount() }
  })
})
