import type { DesignerController } from '../src/composables'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createDesignerDesignSession } from '../src/components/DesignerCanvas/services'

function controller(): DesignerController {
  const graph = {
    version: 2 as const,
    props: {},
    form: {},
    root: [],
    nodesById: {},
  }
  return {
    diagnostics: computed(() => []),
    dispatch: vi.fn(() => true),
    graph: computed(() => graph),
    selectedId: ref(),
    selectedIds: ref([]),
    selectedMaterial: computed(() => undefined),
    selectedNode: computed(() => undefined),
    selectedNodes: computed(() => []),
    select: vi.fn(),
    addMaterial: vi.fn(() => true),
    performNodeAction: vi.fn(() => true),
  }
}

describe('designer design session', () => {
  it('owns drag, candidate, overlay, geometry, and keyboard target lifecycle', () => {
    const commitMaterial = vi.fn()
    const commitNode = vi.fn()
    const session = createDesignerDesignSession(controller(), { commitMaterial, commitNode })
    const unregister = session.drag.registerKeyboardTargets(() => [{ parentId: null, index: 0 }])

    expect(session.drag.beginMaterialKeyboard('element.input', 'candidate')).toBe(true)
    expect(session.overlayMode.value).toBe('idle')
    session.publishCandidate({ id: 'candidate-command', label: 'Candidate', actions: [] })
    session.publishOverlayMode('keyboard-dragging')
    session.publishGeometry({
      revision: 'geometry-1',
      nodes: [],
      surfaceRect: { bottom: 20, height: 20, left: 0, right: 20, top: 0, width: 20 },
      viewport: { height: 20, width: 20 },
    })

    expect(session.candidateCommand.value?.id).toBe('candidate-command')
    expect(session.runtimeGeometry.value?.revision).toBe('geometry-1')
    expect(session.overlayMode.value).toBe('keyboard-dragging')
    expect(session.drag.finishKeyboard()).toBe(true)
    expect(commitMaterial).toHaveBeenCalledOnce()

    unregister()
    session.dispose()
    session.publishCandidate({ id: 'late', label: 'Late', actions: [] })
    session.publishGeometry({
      revision: 'late',
      nodes: [],
      surfaceRect: { bottom: 1, height: 1, left: 0, right: 1, top: 0, width: 1 },
      viewport: { height: 1, width: 1 },
    })
    session.publishOverlayMode('selected')

    expect(session.candidateCommand.value).toBeUndefined()
    expect(session.runtimeGeometry.value).toBeUndefined()
    expect(session.overlayMode.value).toBe('idle')
  })
})
