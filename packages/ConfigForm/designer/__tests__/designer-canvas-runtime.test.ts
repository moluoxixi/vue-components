// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useDesignerCanvasRuntime } from '../src/components/DesignerCanvas/composables'

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

function createRuntime(overrides: { interactive?: boolean } = {}) {
  const cameraScale = ref(1)
  const elementVersion = ref(0)
  const published = vi.fn()
  const selected = vi.fn()
  const beginNodeDrag = vi.fn()
  const cancelNodeDrag = vi.fn()
  const finishNodeDrag = vi.fn()
  const sheet = document.createElement('div')
  vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue(rect(10, 20, 300, 400) as DOMRect)
  const runtime = useDesignerCanvasRuntime({
    beginNodeDragFromRuntime: beginNodeDrag,
    cameraScale: () => cameraScale.value,
    cancelNodeDragFromRuntime: cancelNodeDrag,
    elementVersion,
    finishNodeDragFromRuntime: finishNodeDrag,
    focusNode: vi.fn(),
    interactive: () => overrides.interactive ?? false,
    model: () => ({}),
    onGeometryChange: () => {
      elementVersion.value += 1
    },
    onSelect: selected,
    onUpdateField: vi.fn(),
    publishGeometry: published,
    selectedId: () => undefined,
    selectedIds: () => [],
    sheetRef: ref(sheet),
  })
  return { beginNodeDrag, cameraScale, cancelNodeDrag, finishNodeDrag, published, runtime, selected }
}

function pointer(overrides: Partial<{ button: number, clientX: number, clientY: number, ctrlKey: boolean, metaKey: boolean, nodeId: string, pointerId: number, shiftKey: boolean }> = {}) {
  return {
    button: 0,
    clientX: 50,
    clientY: 60,
    ctrlKey: false,
    metaKey: false,
    pointerId: 7,
    shiftKey: false,
    ...overrides,
  }
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

  it('removes geometry when the host replaces its node snapshot', () => {
    const { runtime } = createRuntime()
    const snapshot = {
      revision: 'first',
      nodes: [{ depth: 0, nodeId: 'field', order: 0, path: 'field', rect: rect(20, 30, 40, 50) }],
      surfaceRect: rect(10, 20, 300, 400),
      viewport: { height: 400, width: 300 },
    }
    runtime.runtimeHostBridge.updateGeometry(snapshot)
    expect(runtime.runtimeNodeGeometryById('field')).toBeDefined()
    runtime.runtimeHostBridge.updateGeometry({ ...snapshot, revision: 'empty', nodes: [] })
    expect(runtime.runtimeNodeGeometryById('field')).toBeUndefined()
  })

  it('promotes an armed node press into a drag once it crosses the threshold', () => {
    const { beginNodeDrag, finishNodeDrag, runtime, selected } = createRuntime()
    runtime.runtimeHostBridge.pointerDown(pointer({ nodeId: 'field' }))
    expect(selected).toHaveBeenCalledWith('field', 'replace')

    // Below the activation distance nothing starts.
    runtime.runtimeHostBridge.pointerMove(pointer({ clientX: 52, clientY: 61 }))
    expect(beginNodeDrag).not.toHaveBeenCalled()

    runtime.runtimeHostBridge.pointerMove(pointer({ clientX: 50, clientY: 80 }))
    expect(beginNodeDrag).toHaveBeenCalledWith('field', { x: 50, y: 80 }, 7)

    // The handoff disarms the press: further frame moves do not restart it.
    runtime.runtimeHostBridge.pointerMove(pointer({ clientX: 50, clientY: 120 }))
    expect(beginNodeDrag).toHaveBeenCalledTimes(1)

    runtime.runtimeHostBridge.pointerUp(pointer({ clientX: 50, clientY: 120 }))
    expect(finishNodeDrag).toHaveBeenCalledWith({ x: 50, y: 120 }, 7)
  })

  it('keeps clicks, other pointers, and modifier or interactive presses inert', () => {
    const { beginNodeDrag, runtime } = createRuntime()
    runtime.runtimeHostBridge.pointerDown(pointer({ nodeId: 'field' }))
    runtime.runtimeHostBridge.pointerUp(pointer())
    runtime.runtimeHostBridge.pointerMove(pointer({ clientX: 300, clientY: 300 }))
    expect(beginNodeDrag).not.toHaveBeenCalled()

    runtime.runtimeHostBridge.pointerDown(pointer({ nodeId: 'field' }))
    runtime.runtimeHostBridge.pointerMove(pointer({ clientX: 300, clientY: 300, pointerId: 9 }))
    expect(beginNodeDrag).not.toHaveBeenCalled()
    runtime.runtimeHostBridge.pointerCancel(pointer())

    runtime.runtimeHostBridge.pointerDown(pointer({ nodeId: 'field', shiftKey: true }))
    runtime.runtimeHostBridge.pointerMove(pointer({ clientX: 300, clientY: 300 }))
    expect(beginNodeDrag).not.toHaveBeenCalled()

    const interactive = createRuntime({ interactive: true })
    interactive.runtime.runtimeHostBridge.pointerDown(pointer({ nodeId: 'field' }))
    interactive.runtime.runtimeHostBridge.pointerMove(pointer({ clientX: 300, clientY: 300 }))
    expect(interactive.beginNodeDrag).not.toHaveBeenCalled()
  })
})
