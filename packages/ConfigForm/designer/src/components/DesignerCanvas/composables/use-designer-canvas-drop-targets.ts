import type { PageGraph, PageNode, ProjectCommand } from '@moluoxixi/config-form-model'
import type { Ref } from 'vue'
import type { DesignerDropTarget, DesignNodeLocation } from '../../../graph'
import type { DesignerCanvasProps, DesignerDragController, DesignerDragSource, DesignerPointerPosition, DesignerRuntimeNodeGeometry, DesignerRuntimeRect } from '../types'
import { hitTestDesignNodes } from '@moluoxixi/config-form-model'
import { onBeforeUnmount } from 'vue'
import { findDesignNode } from '../../../graph'
import {
  resolveDesignerAutoScrollDelta,
  resolveDesignerCollapsedDropTarget,
  resolveDesignerFlowAxis,
  resolveDesignerFlowRatio,
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
    return hitTestDesignNodes(point, options.runtimeNodeGeometry().filter(geometry => geometry.nodeId !== candidateId))
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

  // Flow axis of a node among its rendered siblings; drives whether
  // before/after decisions read the pointer on the X or the Y axis.
  function siblingFlowAxis(
    location: DesignNodeLocation,
    rectById: Map<string, DesignerRuntimeRect>,
  ): 'row' | 'column' {
    return resolveDesignerFlowAxis(location.sequence.map(item => rectById.get(item.nodeId)))
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
    // Stop the frame loop while the pointer rests outside the edge bands; the
    // next pointer move reschedules it through resolveDropTarget.
    if (delta.x === 0 && delta.y === 0)
      return
    const { scrollLeft, scrollTop } = viewport
    viewport.scrollBy(delta.x, delta.y)
    // At the scroll bounds the scroll is a no-op: rescheduling would spin the
    // resolve/geometry pipeline at full speed for as long as the pointer sits
    // in the edge band, freezing the page.
    if (viewport.scrollLeft === scrollLeft && viewport.scrollTop === scrollTop)
      return
    options.onGeometryChange()
    options.dragController?.move(point)
    if (autoScrollFrame === undefined)
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
    const rectById = new Map(options.runtimeNodeGeometry().map(geometry => [geometry.nodeId, geometry.rect]))
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
      const slot = acceptedSlot(location.node, node)
      if (!slot)
        return []
      // The edge band falls through to sibling insertion next to the
      // container, so it follows the container's own flow among siblings.
      const bandRatio = resolveDesignerFlowRatio(point, geometry.rect, siblingFlowAxis(location, rectById))
      if (bandRatio < 0.2 || bandRatio > 0.8)
        return []
      // Append at the end of the slot: a position-insensitive index keeps the
      // target stable while the candidate reflows siblings under the pointer.
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

    // Keep the previous target while the pointer stays inside its parent so
    // candidate churn does not reshuffle the layout under a moving pointer.
    const stickyTarget = resolveStickyDesignerDropTarget(
      previous,
      hits.map(geometry => geometry.nodeId),
      isValidTarget,
    )
    if (stickyTarget)
      return stickyTarget

    // First entry next to a node: insert before/after the deepest hit along
    // its rendered flow axis (row for side-by-side siblings, column otherwise).
    const location = findDesignNode(options.graph(), hitId)
    if (location) {
      const ratio = resolveDesignerFlowRatio(point, hit.rect, siblingFlowAxis(location, rectById))
      const target = siblingTarget(hitId, ratio > 0.5)
      if (target && isValidTarget(target))
        return target
    }

    return previous
  }

  onBeforeUnmount(stopCanvasAutoScroll)

  return {
    hitNodeElements,
    keyboardDropTargets,
    resolveDropTarget,
    stopCanvasAutoScroll,
  }
}
