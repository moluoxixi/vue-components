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

function createRuntime() {
  const cameraScale = ref(1)
  const elementVersion = ref(0)
  const published = vi.fn()
  const selected = vi.fn()
  const sheet = document.createElement('div')
  vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue(rect(10, 20, 300, 400) as DOMRect)
  const runtime = useDesignerCanvasRuntime({
    cameraScale: () => cameraScale.value,
    elementVersion,
    focusNode: vi.fn(),
    interactive: () => false,
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
})
