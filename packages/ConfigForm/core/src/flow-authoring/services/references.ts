import type {
  ConfigFormFlowStep,
  ConfigFormFlowStepOutput,
} from '../types'
import { analyzeConfigFormFlowStepTree } from './validation'

/**
 * Lists action results guaranteed to exist before the addressed step runs.
 * Outputs produced only by one side of a branch are excluded after that branch
 * rejoins; a branch that terminates does not participate in the join set.
 */
export function getConfigFormFlowStepOutputs(
  steps: readonly ConfigFormFlowStep[],
  stepId: string,
): ConfigFormFlowStepOutput[] {
  const analysis = analyzeConfigFormFlowStepTree(steps)
  const available = analysis.availableOutputs.get(stepId)
  if (!available)
    return []
  return analysis.actions
    .filter(action => available.has(action.id))
    .map(action => ({
      stepId: action.id,
      ...(action.title === undefined ? {} : { title: action.title }),
      ref: action.ref,
    }))
}
