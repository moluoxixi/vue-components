// @vitest-environment happy-dom

import type { PageGraph } from '@moluoxixi/config-form-model'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useDesignerCanvasRuntime } from '../src/components/DesignerCanvas/composables'
import { createDesignerRegistry } from '../src/registry'

const graph: PageGraph = {
  version: 2,
  form: {},
  props: {},
  root: [{ nodeId: 'field', placement: {} }],
  nodesById: {
    field: {
      id: 'field',
      component: 'test.input',
      kind: 'field',
      field: 'field',
      bindings: {},
      events: {},
      props: {},
    },
  },
}

function rect(left: number, top: number, width: number, height: number) {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  }
}

function createRuntime() {
  const cameraScale = ref(1)
  const elementVersion = ref(0)
  const published = vi.fn()
  const selected = vi.fn()
  const sheet = document.createElement('div')
  vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue(rect(10, 20, 300, 400) as DOMRect)
  const runtime = useDesignerCanvasRuntime({
    cameraScale: () => cameraScale.value,
    candidateId: () => undefined,
    candidateUsesFallback: () => false,
    elementVersion,
    focusNode: vi.fn(),
    graph: () => graph,
    hasRuntimeSlot: () => true,
    interactive: () => false,
    model: () => ({}),
    observeElement: vi.fn(),
    onGeometryChange: () => {
      elementVersion.value += 1
    },
    onSelect: selected,
    onUpdateField: vi.fn(),
    projectedGraph: () => graph,
    publishGeometry: published,
    registry: () => createDesignerRegistry({ materials: [] }),
    selectedId: () => undefined,
    selectedIds: () => [],
    sheetRef: ref(sheet),
    unobserveElement: vi.fn(),
  })
  return { cameraScale, published, runtime, selected }
}

describe('designer canvas runtime bridge', () => {
  it('rejects invalid geometry and re-anchors valid geometry when camera scale changes', () => {
    const { cameraScale, published, runtime } = createRuntime()
    runtime.runtimeHostBridge.updateGeometry({
      revision: 'invalid',
      nodes: [],
      surfaceRect: rect(0, 0, Number.NaN, 10),
      viewport: { height: 100, width: 100 },
    })
    expect(published).not.toHaveBeenCalled()

    runtime.runtimeHostBridge.updateGeometry({
      revision: 'valid',
      nodes: [{ depth: 0, nodeId: 'field', order: 0, path: 'field', rect: rect(20, 30, 40, 50) }],
      surfaceRect: rect(10, 20, 300, 400),
      viewport: { height: 400, width: 300 },
    })
    cameraScale.value = 2

    expect(runtime.runtimeNodeGeometryById('field')?.rect).toEqual(rect(30, 40, 80, 100))
    expect(published).toHaveBeenCalledOnce()
  })

  it('keeps a newer node registration when an older cleanup runs', () => {
    const { runtime } = createRuntime()
    const first = document.createElement('div')
    const second = document.createElement('div')
    const metadata = { nodeId: 'field' } as never
    const registerNode = runtime.editorBridge.value.registerNode
    expect(registerNode).toBeDefined()
    const cleanupFirst = registerNode?.(metadata, first)
    const cleanupSecond = registerNode?.(metadata, second)
    expect(cleanupFirst).toBeTypeOf('function')
    expect(cleanupSecond).toBeTypeOf('function')

    if (typeof cleanupFirst !== 'function' || typeof cleanupSecond !== 'function')
      throw new TypeError('Expected runtime node cleanup callbacks.')
    cleanupFirst()
    expect(runtime.nodeElements.get('field')).toBe(second)
    cleanupSecond()
    expect(runtime.nodeElements.has('field')).toBe(false)
  })
})
