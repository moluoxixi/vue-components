import type {
  ConfigFormFlowAuthoringDiagnostic,
  ConfigFormFlowStep,
  ConfigFormFlowStepEditResult,
  ConfigFormFlowStepTarget,
} from '../types'
import { analyzeConfigFormFlowStepTree, validateConfigFormFlowSteps } from './validation'

interface LocatedStep {
  index: number
  sequence: ConfigFormFlowStep[]
}

export function insertConfigFormFlowStep(
  steps: readonly ConfigFormFlowStep[],
  step: ConfigFormFlowStep,
  target: ConfigFormFlowStepTarget = {},
): ConfigFormFlowStepEditResult {
  const sourceDiagnostics = analyzeConfigFormFlowStepTree(steps, { references: false }).diagnostics
  const stepDiagnostics = analyzeConfigFormFlowStepTree([step], { references: false }).diagnostics
  if (sourceDiagnostics.length > 0 || stepDiagnostics.length > 0) {
    return {
      applied: false,
      success: false,
      steps: [],
      diagnostics: [...sourceDiagnostics, ...stepDiagnostics],
    }
  }

  const next = structuredClone(steps) as ConfigFormFlowStep[]
  const sequence = resolveTargetSequence(next, target)
  const targetError = validateTarget(sequence, target)
  if (targetError)
    return failedEdit(steps, targetError)
  sequence!.splice(target.index ?? sequence!.length, 0, structuredClone(step))
  return appliedEdit(next)
}

export function moveConfigFormFlowStep(
  steps: readonly ConfigFormFlowStep[],
  stepId: string,
  target: ConfigFormFlowStepTarget,
): ConfigFormFlowStepEditResult {
  const sourceDiagnostics = analyzeConfigFormFlowStepTree(steps, { references: false }).diagnostics
  if (sourceDiagnostics.length > 0)
    return { applied: false, success: false, steps: [], diagnostics: sourceDiagnostics }

  const next = structuredClone(steps) as ConfigFormFlowStep[]
  const located = locateStep(next, stepId)
  if (!located) {
    return failedEdit(steps, {
      code: 'FLOW_AUTHORING_STEP_NOT_FOUND',
      message: `Flow step ${stepId} was not found.`,
      stepId,
    })
  }
  const [moving] = located.sequence.splice(located.index, 1)
  const sequence = resolveTargetSequence(next, target)
  const targetError = validateTarget(sequence, target)
  if (targetError)
    return failedEdit(steps, targetError)
  sequence!.splice(target.index ?? sequence!.length, 0, moving!)
  return appliedEdit(next)
}

export function removeConfigFormFlowStep(
  steps: readonly ConfigFormFlowStep[],
  stepId: string,
): ConfigFormFlowStepEditResult {
  const sourceDiagnostics = analyzeConfigFormFlowStepTree(steps, { references: false }).diagnostics
  if (sourceDiagnostics.length > 0)
    return { applied: false, success: false, steps: [], diagnostics: sourceDiagnostics }

  const next = structuredClone(steps) as ConfigFormFlowStep[]
  const located = locateStep(next, stepId)
  if (!located) {
    return failedEdit(steps, {
      code: 'FLOW_AUTHORING_STEP_NOT_FOUND',
      message: `Flow step ${stepId} was not found.`,
      stepId,
    })
  }
  located.sequence.splice(located.index, 1)
  return appliedEdit(next)
}

function resolveTargetSequence(
  steps: ConfigFormFlowStep[],
  target: ConfigFormFlowStepTarget,
): ConfigFormFlowStep[] | undefined {
  if (target.parentId === undefined)
    return target.branch === undefined ? steps : undefined
  if (target.branch === undefined)
    return undefined
  const parent = findStep(steps, target.parentId)
  return parent?.type === 'condition' ? parent[target.branch] : undefined
}

function validateTarget(
  sequence: ConfigFormFlowStep[] | undefined,
  target: ConfigFormFlowStepTarget,
): ConfigFormFlowAuthoringDiagnostic | undefined {
  if (!sequence) {
    return {
      code: 'FLOW_AUTHORING_TARGET_INVALID',
      message: target.parentId === undefined
        ? 'Root insert targets cannot specify a branch.'
        : `Condition branch target ${target.parentId} was not found.`,
      ...(target.parentId === undefined ? {} : { stepId: target.parentId }),
    }
  }
  const index = target.index ?? sequence.length
  if (!Number.isInteger(index) || index < 0 || index > sequence.length) {
    return {
      code: 'FLOW_AUTHORING_TARGET_INDEX_INVALID',
      message: `Insert index ${String(target.index)} is outside the target sequence.`,
    }
  }
  return undefined
}

function appliedEdit(steps: ConfigFormFlowStep[]): ConfigFormFlowStepEditResult {
  const diagnostics = validateConfigFormFlowSteps(steps)
  return {
    applied: true,
    success: diagnostics.length === 0,
    steps,
    diagnostics,
  }
}

function failedEdit(
  steps: readonly ConfigFormFlowStep[],
  diagnostic: ConfigFormFlowAuthoringDiagnostic,
): ConfigFormFlowStepEditResult {
  return {
    applied: false,
    success: false,
    steps: structuredClone(steps) as ConfigFormFlowStep[],
    diagnostics: [diagnostic],
  }
}

function locateStep(steps: ConfigFormFlowStep[], id: string): LocatedStep | undefined {
  const sequences: ConfigFormFlowStep[][] = [steps]
  while (sequences.length > 0) {
    const sequence = sequences.pop()!
    for (let index = 0; index < sequence.length; index += 1) {
      const step = sequence[index]!
      if (step.id === id)
        return { index, sequence }
      if (step.type === 'condition') {
        sequences.push(step.else)
        sequences.push(step.then)
      }
    }
  }
  return undefined
}

function findStep(steps: ConfigFormFlowStep[], id: string): ConfigFormFlowStep | undefined {
  return locateStep(steps, id)?.sequence.find(step => step.id === id)
}
