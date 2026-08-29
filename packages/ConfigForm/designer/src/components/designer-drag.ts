import type { InjectionKey, ShallowRef } from 'vue'
import type { DesignerNode } from '../document'
import type { DesignerDropTarget } from '../history'
import type { DesignerRegistry } from '../registry'
import { shallowRef } from 'vue'

export interface DesignerPointerPosition {
  x: number
  y: number
}

export interface DesignerDropGeometryCandidate {
  depth: number
  rect: {
    bottom: number
    height: number
    left: number
    right: number
    top: number
    width: number
  }
  specificity: number
  target: DesignerDropTarget
}

export type DesignerDragSource
  = | { type: 'material', materialKey: string, candidateId: string }
    | { type: 'node', nodeId: string, candidateId: string }

export type DesignerDragInput = 'pointer' | 'keyboard'

export interface DesignerDragAnnouncement {
  type: 'picked-up' | 'target' | 'dropped' | 'cancelled'
  source: DesignerDragSource
  target?: DesignerDropTarget
}

export interface DesignerDragSession {
  source: DesignerDragSource
  origin: DesignerPointerPosition
  input: DesignerDragInput
  active: boolean
  target?: DesignerDropTarget
}

export type DesignerDropTargetResolver = (
  point: DesignerPointerPosition,
  source: DesignerDragSource,
  previous?: DesignerDropTarget,
) => DesignerDropTarget | undefined

export type DesignerKeyboardDropTargetsResolver = (
  source: DesignerDragSource,
) => DesignerDropTarget[]

export interface DesignerDragController {
  session: ShallowRef<DesignerDragSession | undefined>
  announcement: ShallowRef<DesignerDragAnnouncement | undefined>
  beginMaterial: (materialKey: string, candidateId: string, point: DesignerPointerPosition) => void
  beginNode: (nodeId: string, point: DesignerPointerPosition) => void
  beginMaterialKeyboard: (materialKey: string, candidateId: string) => boolean
  beginNodeKeyboard: (nodeId: string) => boolean
  move: (point: DesignerPointerPosition) => boolean
  moveKeyboard: (direction: 'next' | 'previous') => boolean
  finish: (point: DesignerPointerPosition) => void
  finishKeyboard: () => boolean
  cancel: () => void
  registerResolver: (resolver: DesignerDropTargetResolver) => () => void
  registerKeyboardTargets: (resolver: DesignerKeyboardDropTargetsResolver) => () => void
}

export interface CreateDesignerDragControllerOptions {
  commitMaterial: (source: Extract<DesignerDragSource, { type: 'material' }>, target: DesignerDropTarget) => void
  commitNode: (nodeId: string, target: DesignerDropTarget) => void
}

export const DESIGNER_DRAG_KEY: InjectionKey<DesignerDragController> = Symbol('config-form-designer-drag')

export function resolveDesignerAutoScrollDelta(
  point: DesignerPointerPosition,
  rect: Pick<DOMRect, 'bottom' | 'left' | 'right' | 'top'>,
  edgeSize = 48,
  maxSpeed = 18,
): DesignerPointerPosition {
  const axisDelta = (coordinate: number, start: number, end: number): number => {
    if (coordinate < start || coordinate > end)
      return 0
    if (coordinate < start + edgeSize)
      return -Math.ceil(maxSpeed * (1 - (coordinate - start) / edgeSize))
    if (coordinate > end - edgeSize)
      return Math.ceil(maxSpeed * (1 - (end - coordinate) / edgeSize))
    return 0
  }
  return {
    x: axisDelta(point.x, rect.left, rect.right),
    y: axisDelta(point.y, rect.top, rect.bottom),
  }
}

export function resolveDesignerCollapsedDropTarget(
  point: DesignerPointerPosition,
  candidates: readonly DesignerDropGeometryCandidate[],
  minimumHeight = 36,
): DesignerDropTarget | undefined {
  return candidates
    .filter(({ rect }) => {
      if (rect.width <= 0 || rect.height >= minimumHeight)
        return false
      const verticalInset = (minimumHeight - rect.height) / 2
      return point.x >= rect.left
        && point.x <= rect.right
        && point.y >= rect.top - verticalInset
        && point.y <= rect.bottom + verticalInset
    })
    .sort((left, right) => right.specificity - left.specificity || right.depth - left.depth)[0]
    ?.target
}

export function resolveStickyDesignerDropTarget(
  previous: DesignerDropTarget | undefined,
  hitNodeIds: readonly string[],
  isValid: (target: DesignerDropTarget) => boolean,
): DesignerDropTarget | undefined {
  if (previous?.parentId === null || !previous?.slot || !hitNodeIds.includes(previous.parentId))
    return undefined
  return isValid(previous) ? previous : undefined
}

function sameTarget(left?: DesignerDropTarget, right?: DesignerDropTarget): boolean {
  const leftSlot = left?.parentId === null ? undefined : left?.slot
  const rightSlot = right?.parentId === null ? undefined : right?.slot
  return left?.parentId === right?.parentId
    && leftSlot === rightSlot
    && left?.index === right?.index
}

export function createDesignerDragController(
  options: CreateDesignerDragControllerOptions,
): DesignerDragController {
  const session = shallowRef<DesignerDragSession>()
  const announcement = shallowRef<DesignerDragAnnouncement>()
  let resolver: DesignerDropTargetResolver | undefined
  let keyboardTargetsResolver: DesignerKeyboardDropTargetsResolver | undefined

  function begin(source: DesignerDragSource, point: DesignerPointerPosition, input: DesignerDragInput): void {
    session.value = { source, origin: point, input, active: input === 'keyboard' }
  }

  function beginKeyboard(source: DesignerDragSource): boolean {
    const targets = keyboardTargetsResolver?.(source) ?? []
    if (!targets[0])
      return false
    begin(source, { x: 0, y: 0 }, 'keyboard')
    session.value = { ...session.value!, target: targets[0] }
    announcement.value = { type: 'picked-up', source, target: targets[0] }
    return true
  }

  function move(point: DesignerPointerPosition): boolean {
    const current = session.value
    if (!current)
      return false

    const active = current.active
      || Math.hypot(point.x - current.origin.x, point.y - current.origin.y) >= 4
    if (!active)
      return false

    const target = resolver?.(point, current.source, current.target)
    if (current.active && sameTarget(current.target, target))
      return true

    session.value = { ...current, active: true, target }
    return true
  }

  function moveKeyboard(direction: 'next' | 'previous'): boolean {
    const current = session.value
    if (!current?.active || current.input !== 'keyboard')
      return false
    const targets = keyboardTargetsResolver?.(current.source) ?? []
    if (targets.length === 0)
      return false
    const currentIndex = targets.findIndex(target => sameTarget(target, current.target))
    const delta = direction === 'next' ? 1 : -1
    const nextIndex = currentIndex < 0
      ? 0
      : (currentIndex + delta + targets.length) % targets.length
    const target = targets[nextIndex]!
    session.value = { ...current, target }
    announcement.value = { type: 'target', source: current.source, target }
    return true
  }

  function commitCurrent(): boolean {
    const completed = session.value
    session.value = undefined
    if (!completed?.active || !completed.target)
      return false
    if (completed.source.type === 'material')
      options.commitMaterial(completed.source, completed.target)
    else
      options.commitNode(completed.source.nodeId, completed.target)
    announcement.value = { type: 'dropped', source: completed.source, target: completed.target }
    return true
  }

  function finish(point: DesignerPointerPosition): void {
    const current = session.value
    if (!current)
      return
    move(point)
    commitCurrent()
  }

  return {
    session,
    announcement,
    beginMaterial: (materialKey, candidateId, point) => begin({ type: 'material', materialKey, candidateId }, point, 'pointer'),
    beginNode: (nodeId, point) => begin({ type: 'node', nodeId, candidateId: nodeId }, point, 'pointer'),
    beginMaterialKeyboard: (materialKey, candidateId) => beginKeyboard({ type: 'material', materialKey, candidateId }),
    beginNodeKeyboard: nodeId => beginKeyboard({ type: 'node', nodeId, candidateId: nodeId }),
    move,
    moveKeyboard,
    finish,
    finishKeyboard: commitCurrent,
    cancel: () => {
      const current = session.value
      session.value = undefined
      if (current)
        announcement.value = { type: 'cancelled', source: current.source, target: current.target }
    },
    registerResolver: (nextResolver) => {
      resolver = nextResolver
      return () => {
        if (resolver === nextResolver)
          resolver = undefined
      }
    },
    registerKeyboardTargets: (nextResolver) => {
      keyboardTargetsResolver = nextResolver
      return () => {
        if (keyboardTargetsResolver === nextResolver)
          keyboardTargetsResolver = undefined
      }
    },
  }
}

export function createDesignerMaterialCandidate(
  registry: DesignerRegistry,
  materialKey: string,
  candidateId: string,
): DesignerNode | undefined {
  const material = registry.getMaterial(materialKey)
  if (!material)
    return undefined
  const field = `candidate_${candidateId.replace(/\W+/g, '_')}`
  try {
    return registry.createNode(materialKey, {
      id: candidateId,
      ...(material.kind === 'field' ? { field } : {}),
    })
  }
  catch {
    return undefined
  }
}
