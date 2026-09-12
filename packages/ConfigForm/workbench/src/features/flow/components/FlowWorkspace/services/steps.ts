import type { ConfigFormFlowStep } from '@moluoxixi/config-form-core'
import type {
  FlowStepTarget,
  FlowTreeEntry,
} from '../types'
import { cloneWorkbenchJson as structuredClone } from '../../../../../utils'

interface LocatedStep {
  index: number
  sequence: ConfigFormFlowStep[]
  target: FlowStepTarget
}

export function flattenFlowSteps(steps: readonly ConfigFormFlowStep[]): FlowTreeEntry[] {
  const entries: FlowTreeEntry[] = []

  function visit(
    sequence: readonly ConfigFormFlowStep[],
    depth: number,
    container: Omit<FlowStepTarget, 'index'>,
  ): void {
    sequence.forEach((step, index) => {
      entries.push({
        entryType: 'step',
        step,
        depth,
        index,
        target: { ...container, index },
      })
      if (step.type !== 'condition')
        return
      for (const branch of ['then', 'else'] as const) {
        const branchSteps = step[branch]
        entries.push({
          entryType: 'branch',
          conditionId: step.id,
          branch,
          depth: depth + 1,
          index: branchSteps.length,
          empty: branchSteps.length === 0,
        })
        visit(branchSteps, depth + 2, { parentId: step.id, branch })
      }
    })
  }

  visit(steps, 0, {})
  return entries
}

export function findFlowStep(
  steps: readonly ConfigFormFlowStep[],
  stepId: string | undefined,
): ConfigFormFlowStep | undefined {
  if (!stepId)
    return undefined
  const stack = [...steps].reverse()
  while (stack.length > 0) {
    const step = stack.pop()!
    if (step.id === stepId)
      return step
    if (step.type === 'condition') {
      for (let index = step.else.length - 1; index >= 0; index -= 1)
        stack.push(step.else[index]!)
      for (let index = step.then.length - 1; index >= 0; index -= 1)
        stack.push(step.then[index]!)
    }
  }
  return undefined
}

export function collectFlowStepIds(steps: readonly ConfigFormFlowStep[]): Set<string> {
  const ids = new Set<string>()
  const stack = [...steps]
  while (stack.length > 0) {
    const step = stack.pop()!
    ids.add(step.id)
    if (step.type === 'condition')
      stack.push(...step.then, ...step.else)
  }
  return ids
}

export function insertFlowStepDraft(
  steps: readonly ConfigFormFlowStep[],
  step: ConfigFormFlowStep,
  target: FlowStepTarget = {},
): ConfigFormFlowStep[] | undefined {
  const next = structuredClone(steps) as ConfigFormFlowStep[]
  const sequence = resolveSequence(next, target)
  if (!sequence)
    return undefined
  const index = clampIndex(target.index, sequence.length)
  sequence.splice(index, 0, structuredClone(step))
  return next
}

export function replaceFlowStepDraft(
  steps: readonly ConfigFormFlowStep[],
  stepId: string,
  replacement: ConfigFormFlowStep,
): ConfigFormFlowStep[] | undefined {
  const next = structuredClone(steps) as ConfigFormFlowStep[]
  const located = locateStep(next, stepId)
  if (!located)
    return undefined
  located.sequence.splice(located.index, 1, structuredClone(replacement))
  return next
}

export function removeFlowStepDraft(
  steps: readonly ConfigFormFlowStep[],
  stepId: string,
): ConfigFormFlowStep[] | undefined {
  const next = structuredClone(steps) as ConfigFormFlowStep[]
  const located = locateStep(next, stepId)
  if (!located)
    return undefined
  located.sequence.splice(located.index, 1)
  return next
}

export function moveFlowStepDraft(
  steps: readonly ConfigFormFlowStep[],
  stepId: string,
  direction: -1 | 1,
): ConfigFormFlowStep[] | undefined {
  const next = structuredClone(steps) as ConfigFormFlowStep[]
  const located = locateStep(next, stepId)
  if (!located)
    return undefined
  const destination = located.index + direction
  if (destination < 0 || destination >= located.sequence.length)
    return undefined
  const [step] = located.sequence.splice(located.index, 1)
  located.sequence.splice(destination, 0, step!)
  return next
}

export function canMoveFlowStep(
  steps: readonly ConfigFormFlowStep[],
  stepId: string,
  direction: -1 | 1,
): boolean {
  const next = structuredClone(steps) as ConfigFormFlowStep[]
  const located = locateStep(next, stepId)
  return !!located
    && located.index + direction >= 0
    && located.index + direction < located.sequence.length
}

function locateStep(
  steps: ConfigFormFlowStep[],
  stepId: string,
  target: Omit<FlowStepTarget, 'index'> = {},
): LocatedStep | undefined {
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]!
    if (step.id === stepId)
      return { index, sequence: steps, target: { ...target, index } }
    if (step.type === 'condition') {
      const thenLocation = locateStep(step.then, stepId, { parentId: step.id, branch: 'then' })
      if (thenLocation)
        return thenLocation
      const elseLocation = locateStep(step.else, stepId, { parentId: step.id, branch: 'else' })
      if (elseLocation)
        return elseLocation
    }
  }
  return undefined
}

function resolveSequence(
  steps: ConfigFormFlowStep[],
  target: FlowStepTarget,
): ConfigFormFlowStep[] | undefined {
  if (!target.parentId)
    return steps
  const parent = findFlowStep(steps, target.parentId)
  if (parent?.type !== 'condition' || (target.branch !== 'then' && target.branch !== 'else'))
    return undefined
  return parent[target.branch]
}

function clampIndex(index: number | undefined, length: number): number {
  if (!Number.isInteger(index))
    return length
  return Math.max(0, Math.min(length, index!))
}
