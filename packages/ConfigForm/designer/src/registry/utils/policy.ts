import type {
  DesignerDesignPolicy,
  DesignerResolvedDesignPolicy,
} from '../types'
import { DEFAULT_DESIGNER_DESIGN_POLICY } from '../constants'

export function resolveDesignerDesignPolicy(
  policy?: DesignerDesignPolicy,
): DesignerResolvedDesignPolicy {
  if (!policy)
    return { ...DEFAULT_DESIGNER_DESIGN_POLICY }

  const adapterRequired = policy.async === 'adapter'
    || policy.sideEffects === 'adapter'
    || policy.render === 'adapter'
    || policy.adapter !== undefined

  return {
    render: adapterRequired ? 'adapter' : 'runtime',
    interaction: policy.interaction ?? 'preview',
    async: policy.async ?? 'blocked',
    sideEffects: policy.sideEffects ?? 'blocked',
    ...(policy.adapter === undefined ? {} : { adapter: policy.adapter }),
    ...(policy.visualEquivalence === undefined ? {} : { visualEquivalence: policy.visualEquivalence }),
    ...(policy.diagnostic === undefined ? {} : { diagnostic: policy.diagnostic.trim() }),
  }
}
