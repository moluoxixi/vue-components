import type { DesignerMaterialDefinition } from '../src/registry'
import { describe, expect, it, vi } from 'vitest'
import {
  createDesignerDragController,
  createDesignerMaterialCandidate,
  resolveDesignerAutoScrollDelta,
  resolveDesignerCollapsedDropTarget,
  resolveDesignerDragOverlayPosition,
  resolveDesignerDragVisualHeight,
  resolveStickyDesignerDropTarget,
} from '../src/components/designer-drag'
import { createMoveCommand } from '../src/graph'
import { createDesignerRegistry } from '../src/registry'

const material: DesignerMaterialDefinition = {
  key: 'element.input',
  version: 1,
  kind: 'field',
  title: 'Input',
  category: 'Fields',
  runtime: { component: 'input' },
  setters: [],
  createNode: ({ id, field = 'input' }) => ({
    id,
    field,
    kind: 'field',
    component: 'element.input',
    props: { placeholder: 'Type here' },
  }),
}

describe('designer drag controller', () => {
  it('routes the root, list-end, cross-container, and nested pointer/keyboard matrix through the same move command', () => {
    const cases = [
      { id: 'root', target: { parentId: null, index: 0 } as const },
      { id: 'list-end', target: { parentId: 'outer', slot: 'default', index: 2 } as const },
      { id: 'cross-container', target: { parentId: 'sibling-container', slot: 'default', index: 1 } as const },
      { id: 'three-level', target: { parentId: 'inner', slot: 'default', index: 1 } as const },
    ]

    for (const testCase of cases) {
      const commands: ReturnType<typeof createMoveCommand>[] = []
      const controller = createDesignerDragController({
        commitMaterial: vi.fn(),
        commitNode: (nodeId, resolvedTarget) => commands.push(createMoveCommand(
          'home',
          nodeId,
          resolvedTarget,
          { id: `move-${testCase.id}-${commands.length}` },
        )),
      })
      controller.registerResolver(() => testCase.target)
      controller.registerKeyboardTargets(() => [testCase.target])

      controller.beginNode('field-1', { x: 0, y: 0 })
      controller.move({ x: 20, y: 20 })
      controller.finish({ x: 20, y: 20 })
      expect(controller.beginNodeKeyboard('field-1'), testCase.id).toBe(true)
      expect(controller.finishKeyboard(), testCase.id).toBe(true)

      expect(commands, testCase.id).toHaveLength(2)
      expect(commands[0]?.actions, testCase.id).toEqual(commands[1]?.actions)
      expect(commands[0]?.actions, testCase.id).toEqual([{
        type: 'operation.apply',
        operations: [{
          type: 'node.move',
          pageId: 'home',
          nodeId: 'field-1',
          target: testCase.target,
        }],
      }])
    }
  })

  it('commits the exact material candidate once after a legal drop', () => {
    const commitMaterial = vi.fn()
    const controller = createDesignerDragController({
      commitMaterial,
      commitNode: vi.fn(),
    })
    const target = { parentId: null, index: 1 } as const
    controller.registerResolver(() => target)
    controller.beginMaterial('element.input', 'candidate-1', { x: 10, y: 10 })

    expect(controller.move({ x: 12, y: 12 })).toBe(false)
    expect(controller.move({ x: 30, y: 30 })).toBe(true)
    expect(controller.session.value).toMatchObject({
      active: true,
      position: { x: 30, y: 30 },
      source: { candidateId: 'candidate-1', materialKey: 'element.input', type: 'material' },
      target,
    })

    controller.finish({ x: 30, y: 30 })
    expect(commitMaterial).toHaveBeenCalledOnce()
    expect(commitMaterial).toHaveBeenCalledWith({
      candidateId: 'candidate-1',
      materialKey: 'element.input',
      type: 'material',
    }, target)
    expect(controller.session.value).toBeUndefined()
  })

  it('updates pointer position when the resolved target remains unchanged', () => {
    const controller = createDesignerDragController({
      commitMaterial: vi.fn(),
      commitNode: vi.fn(),
    })
    controller.registerResolver(() => ({ parentId: null, index: 0 }))
    controller.beginMaterial('element.input', 'candidate-position', { x: 0, y: 0 }, { x: 20, y: 12 })
    controller.move({ x: 20, y: 20 })
    controller.move({ x: 70, y: 55 })

    expect(controller.session.value).toMatchObject({
      pointerOffset: { x: 20, y: 12 },
      position: { x: 70, y: 55 },
    })
  })

  it('keeps the pointer inside the measured overlay bounds', () => {
    expect(resolveDesignerDragOverlayPosition(
      { x: 100, y: 80 },
      { x: 500, y: -10 },
      { width: 120, height: 40 },
    )).toEqual({ x: -12, y: 72 })
  })

  it('resolves drag visual height from the measured node geometry', () => {
    expect(resolveDesignerDragVisualHeight(0, 'layout')).toBe(36)
    expect(resolveDesignerDragVisualHeight(18, 'layout')).toBe(18)
    expect(resolveDesignerDragVisualHeight(0, 'field')).toBe(1)
  })

  it('does not commit cancelled or targetless drags', () => {
    const commitMaterial = vi.fn()
    const controller = createDesignerDragController({
      commitMaterial,
      commitNode: vi.fn(),
    })
    controller.registerResolver(() => undefined)
    controller.beginMaterial('element.input', 'candidate-2', { x: 0, y: 0 })
    controller.move({ x: 20, y: 20 })
    controller.finish({ x: 20, y: 20 })

    controller.beginMaterial('element.input', 'candidate-3', { x: 0, y: 0 })
    controller.move({ x: 20, y: 20 })
    controller.cancel()
    expect(commitMaterial).not.toHaveBeenCalled()
  })

  it('navigates legal keyboard targets and commits exactly once', () => {
    const commitMaterial = vi.fn()
    const controller = createDesignerDragController({ commitMaterial, commitNode: vi.fn() })
    const targets = [
      { parentId: null, index: 0 },
      { parentId: 'section', slot: 'default', index: 1 },
    ] as const
    controller.registerKeyboardTargets(() => targets.map(target => ({ ...target })))

    expect(controller.beginMaterialKeyboard('element.input', 'candidate-keyboard')).toBe(true)
    expect(controller.session.value).toMatchObject({ input: 'keyboard', active: true, target: targets[0] })
    expect(controller.moveKeyboard('next')).toBe(true)
    expect(controller.session.value?.target).toEqual(targets[1])
    expect(controller.finishKeyboard()).toBe(true)
    expect(commitMaterial).toHaveBeenCalledOnce()
    expect(commitMaterial).toHaveBeenCalledWith(expect.objectContaining({ candidateId: 'candidate-keyboard' }), targets[1])
    expect(controller.announcement.value?.type).toBe('dropped')
  })

  it('announces keyboard cancellation without committing', () => {
    const commitNode = vi.fn()
    const controller = createDesignerDragController({ commitMaterial: vi.fn(), commitNode })
    controller.registerKeyboardTargets(() => [{ parentId: null, index: 0 }])
    controller.beginNodeKeyboard('field-1')
    controller.cancel()

    expect(commitNode).not.toHaveBeenCalled()
    expect(controller.announcement.value).toMatchObject({ type: 'cancelled', source: { nodeId: 'field-1' } })
  })

  it('creates one registry-backed node identity for candidate and commit projections', () => {
    const registry = createDesignerRegistry([{ name: 'test', materials: [material] }])
    const candidate = createDesignerMaterialCandidate(registry, 'element.input', 'candidate-4')
    const committed = createDesignerMaterialCandidate(registry, 'element.input', 'candidate-4')

    expect(candidate).toEqual(committed)
    expect(candidate).toMatchObject({
      node: {
        id: 'candidate-4',
        field: 'candidate_candidate_4',
        props: { placeholder: 'Type here' },
      },
      subgraph: {
        root: [{ nodeId: 'candidate-4', placement: {} }],
      },
    })
  })

  it('keeps a valid nested target sticky while the candidate changes container geometry', () => {
    const target = { parentId: 'section', slot: 'default', index: 0 } as const
    const isValid = vi.fn(() => true)

    expect(resolveStickyDesignerDropTarget(target, ['candidate', 'section'], isValid)).toEqual(target)
    expect(isValid).toHaveBeenCalledWith(target)
    expect(resolveStickyDesignerDropTarget(target, ['other'], isValid)).toBeUndefined()
    expect(resolveStickyDesignerDropTarget({ parentId: null, index: 2 }, ['section'], isValid)).toBeUndefined()
    expect(resolveStickyDesignerDropTarget(target, ['section'], () => false)).toBeUndefined()
  })

  it('resolves the deepest collapsed real container through an inflated design hit band', () => {
    const outer = { parentId: 'card', slot: 'default', index: 1 } as const
    const inner = { parentId: 'flex', slot: 'default', index: 0 } as const
    const rect = { bottom: 120, height: 0, left: 100, right: 420, top: 120, width: 320 }

    expect(resolveDesignerCollapsedDropTarget({ x: 260, y: 132 }, [
      { depth: 2, rect, specificity: 0, target: outer },
      { depth: 5, rect, specificity: 0, target: inner },
    ])).toEqual(inner)
    expect(resolveDesignerCollapsedDropTarget({ x: 260, y: 139 }, [
      { depth: 5, rect, specificity: 0, target: inner },
    ])).toBeUndefined()
    expect(resolveDesignerCollapsedDropTarget({ x: 260, y: 120 }, [
      { depth: 5, rect: { ...rect, height: 40, bottom: 160 }, specificity: 0, target: inner },
    ])).toBeUndefined()
  })

  it('calculates bounded canvas auto-scroll velocity near each edge', () => {
    const rect = { left: 100, right: 500, top: 80, bottom: 480 }
    expect(resolveDesignerAutoScrollDelta({ x: 102, y: 478 }, rect)).toEqual({ x: -18, y: 18 })
    expect(resolveDesignerAutoScrollDelta({ x: 300, y: 280 }, rect)).toEqual({ x: 0, y: 0 })
    expect(resolveDesignerAutoScrollDelta({ x: 40, y: 280 }, rect)).toEqual({ x: 0, y: 0 })
  })
})
