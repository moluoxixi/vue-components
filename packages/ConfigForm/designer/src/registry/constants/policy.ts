import type { DesignerResolvedDesignPolicy } from '../types'

export const DEFAULT_DESIGNER_DESIGN_POLICY: Readonly<DesignerResolvedDesignPolicy> = Object.freeze({
  render: 'runtime',
  interaction: 'preview',
  async: 'blocked',
  sideEffects: 'blocked',
})
