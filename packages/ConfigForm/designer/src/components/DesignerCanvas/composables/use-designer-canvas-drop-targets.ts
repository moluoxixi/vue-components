import type { PageGraph, PageNode, ProjectCommand } from '@moluoxixi/config-form-model'
import type { Ref } from 'vue'
import type { DesignerDropTarget } from '../../../graph'
import type { DesignerCanvasProps, DesignerDragController, DesignerDragSource, DesignerPointerPosition, DesignerRuntimeNodeGeometry } from '../types'
import { onBeforeUnmount } from 'vue'
import { findDesignNode } from '../../../graph'
import {
  resolveDesignerAutoScrollDelta,
  resolveDesignerCollapsedDropTarget,
  resolveStickyDesignerDropTarget,
} from '../services'

interface UseDesignerCanvasDropTargetsOptions {
  activeSource: () => DesignerDragSource | undefined
  cameraViewportRef: Ref<HTMLElement | undefined>
  candidateCommandForSource: (source: DesignerDragSource | undefined, target: DesignerDropTarget) => ProjectCommand | undefined
  candidateNode: () => PageNode | undefined
  candidatePreview: DesignerCanvasProps['candidatePreview']
  dragController: DesignerDragController | undefined
  graph: () => PageGraph
  nodeForDragSource: (source: DesignerDragSource | undefined) => PageNode | undefined
  onGeometryChange: () => void
  registry: () => DesignerCanvasProps['registry']
  runtimeNodeGeometry: () => DesignerRuntimeNodeGeometry[]
  sheetRef: Ref<HTMLElement | undefined>
}

export function useDesignerCanvasDropTargets(options: UseDesignerCanvasDropTargetsOptions) {
  let autoScrollFrame: number | undefined
  let autoScrollPoint: DesignerPointerPosition | undefined

  function acceptedSlot(parent: PageNode, node: PageNode) {
    if (parent.kind !== 'layout')
      return undefined
    const material = options.registry().getMaterial(parent.component)
    if (!material || material.kind !== 'layout')
      return undefined
    return material.slots.find(slot => (
      (!slot.accepts || slot.accepts.includes(node.kind))
      && (!slot.materials || slot.materials.includes(node.component))
      && (slot.max === undefined || (parent.slots[slot.name]?.length ?? 0) < slot.max)
    ))
  }

  function hitNodeElements(point: DesignerPointerPosition, candidateId: string): DesignerRuntimeNodeGeometry[] {
    return options.runtimeNodeGeometry()
      .flatMap((geometry) => {
        if (geometry.nodeId === candidateId)
          return []
        const rect = geometry.rect
        if (rect.width <= 0 || rect.height <= 0
          || point.x < rect.left || point.x > rect.right
          || point.y < rect.top || point.y > rect.bottom) {
          return []
        }
        return [{
          area: rect.width * rect.height,
          geometry,
        }]
      })
      .sort((left, right) => right.geometry.depth - left.geometry.depth
        || left.area - right.area
        || right.geometry.order - left.geometry.order)
      .map(({ geometry }) => geometry)
  }

  function siblingTarget(nodeId: string, after: boolean): DesignerDropTarget | undefined {
    const location = findDesignNode(options.graph(), nodeId)
    if (!location)
      return undefined
    const index = location.index + (after ? 1 : 0)
    return location.parentId !== null && location.slot
      ? { parentId: location.parentId, slot: location.slot, index }
      : { parentId: null, index }
  }

  function isValidTarget(target: DesignerDropTarget, source = options.activeSource()): boolean {
    const command = options.candidateCommandForSource(source, target)
    if (!command)
      return false
    return options.candidatePreview(command) !== undefined
  }

  function keyboardDropTargets(source: DesignerDragSource): DesignerDropTarget[] {
    const node = options.nodeForDragSource(source)
    if (!node)
      return []
    const graph = options.graph()
    const targets: DesignerDropTarget[] = []
    for (let index = 0; index <= graph.root.length; index += 1)
      targets.push({ parentId: null, index })

    const visit = (items: PageGraph['root']): void => {
      for (const item of items) {
        const parent = graph.nodesById[item.nodeId]
        if (!parent || parent.kind !== 'layout')
          continue
        const material = options.registry().getMaterial(parent.component)
        if (material?.kind === 'layout') {
          for (const slot of material.slots) {
            const children = parent.slots[slot.name] ?? []
            const accepts = (!slot.accepts || slot.accepts.includes(node.kind))
              && (!slot.materials || slot.materials.includes(node.component))
            if (accepts) {
              for (let index = 0; index <= children.length; index += 1)
                targets.push({ parentId: parent.id, slot: slot.name, index })
            }
            visit(children)
          }
        }
      }
    }
    visit(graph.root)
    return targets.filter(target => isValidTarget(target, source))
  }

  function scheduleCanvasAutoScroll(point: DesignerPointerPosition): void {
    autoScrollPoint = point
    if (autoScrollFrame !== undefined)
      return
    autoScrollFrame = window.requestAnimationFrame(runCanvasAutoScroll)
  }

  function runCanvasAutoScroll(): void {
    autoScrollFrame = undefined
    const point = autoScrollPoint
    const viewport = options.cameraViewportRef.value
    const session = options.dragController?.session.value
    if (!point || !viewport || !session?.active || session.input !== 'pointer')
      return
    const delta = resolveDesignerAutoScrollDelta(point, viewport.getBoundingClientRect())
    if (delta.x !== 0 || delta.y !== 0) {
      viewport.scrollBy(delta.x, delta.y)
      options.onGeometryChange()
      options.dragController?.move(point)
    }
    autoScrollFrame = window.requestAnimationFrame(runCanvasAutoScroll)
  }

  function stopCanvasAutoScroll(): void {
    autoScrollPoint = undefined
    if (autoScrollFrame !== undefined)
      window.cancelAnimationFrame(autoScrollFrame)
    autoScrollFrame = undefined
  }

  function resolveDropTarget(
    point: DesignerPointerPosition,
    source: DesignerDragSource,
    previous?: DesignerDropTarget,
  ): DesignerDropTarget | undefined {
    const sheet = options.sheetRef.value
    const node = options.candidateNode()
    if (!sheet || !node)
      return undefined
    scheduleCanvasAutoScroll(point)
    const sheetRect = sheet.getBoundingClientRect()
    if (point.x < sheetRect.left || point.x > sheetRect.right || point.y < sheetRect.top || point.y > sheetRect.bottom)
      return undefined

    const hits = hitNodeElements(point, source.candidateId)
    const hit = hits[0]
    const hitId = hit?.nodeId
    const collapsedTarget = resolveDesignerCollapsedDropTarget(
      point,
      options.runtimeNodeGeometry().flatMap((geometry) => {
        if (geometry.nodeId === source.candidateId)
          return []
        const location = findDesignNode(options.graph(), geometry.nodeId)
        if (!location)
          return []
        const slot = acceptedSlot(location.node, node)
        if (!slot)
          return []
        const target = {
          parentId: location.node.id,
          slot: slot.name,
          index: location.node.kind === 'layout' ? (location.node.slots[slot.name]?.length ?? 0) : 0,
        } satisfies DesignerDropTarget
        if (!isValidTarget(target))
          return []
        return [{
          depth: location.path.length,
          rect: geometry.rect,
          specificity: slot.materials?.includes(node.component) ? 1 : 0,
          target,
        }]
      }),
    )
    if (collapsedTarget)
      return collapsedTarget

    if (!hitId) {
      const target = { parentId: null, index: options.graph().root.length } satisfies DesignerDropTarget
      return isValidTarget(target) ? target : previous
    }

    const insideTargets = hits.flatMap((geometry, depth) => {
      const location = findDesignNode(options.graph(), geometry.nodeId)
      if (!location)
        return []
      const rect = geometry.rect
      const verticalRatio = rect.height > 0 ? (point.y - rect.top) / rect.height : 0.5
      const slot = acceptedSlot(location.node, node)
      if (!slot || verticalRatio < 0.2 || verticalRatio > 0.8)
        return []
      const target = {
        parentId: location.node.id,
        slot: slot.name,
        index: location.node.kind === 'layout' ? (location.node.slots[slot.name]?.length ?? 0) : 0,
      } satisfies DesignerDropTarget
      return isValidTarget(target)
        ? [{ depth, specific: slot.materials?.includes(node.component) ? 1 : 0, target }]
        : []
    }).sort((left, right) => right.specific - left.specific || left.depth - right.depth)
    if (insideTargets[0])
      return insideTargets[0].target

    const stickyTarget = resolveStickyDesignerDropTarget(
      previous,
      hits.map(geometry => geometry.nodeId),
      isValidTarget,
    )
    if (stickyTarget)
      return stickyTarget

    const location = findDesignNode(options.graph(), hitId)
    if (!location)
      return previous
    const rect = hit.rect
    const verticalRatio = rect.height > 0 ? (point.y - rect.top) / rect.height : 0.5
    const target = siblingTarget(hitId, verticalRatio > 0.5)
    return target && isValidTarget(target) ? target : previous
  }

  onBeforeUnmount(stopCanvasAutoScroll)

  return {
    hitNodeElements,
    keyboardDropTargets,
    resolveDropTarget,
    stopCanvasAutoScroll,
  }
}
