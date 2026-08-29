import type {
  DesignerDesignPolicy,
  DesignerResolvedDesignPolicy,
} from './types'

export const DEFAULT_DESIGNER_DESIGN_POLICY: Readonly<DesignerResolvedDesignPolicy> = Object.freeze({
  render: 'runtime',
  interaction: 'preview',
  async: 'blocked',
  sideEffects: 'blocked',
})

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
    ...(policy.diagnostic === undefined ? {} : { diagnostic: policy.diagnostic.trim() }),
  }
}
