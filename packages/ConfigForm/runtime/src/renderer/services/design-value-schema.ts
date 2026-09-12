import type { ConfigFormValueSchema } from '@moluoxixi/config-form-headless'
import type { ConfigFormPageRuntimePlan } from '../../runtime'

/** Transient design topology. Initialize its separate model with Core defaults. */
export function projectRendererDesignValueSchema(plan: Pick<ConfigFormPageRuntimePlan, 'valueSchema'>): ConfigFormValueSchema {
  return {
    scopedFields: plan.valueSchema.scopedFields.map(field => ({
      ...field,
      ...(field.defaultValue === undefined ? {} : { defaultValue: JSON.parse(JSON.stringify(field.defaultValue)) }),
    })),
    valueScopes: plan.valueSchema.valueScopes.map(scope => scope.kind === 'array'
      ? { ...scope, minItems: 1, maxItems: 1 }
      : { ...scope }),
  }
}
