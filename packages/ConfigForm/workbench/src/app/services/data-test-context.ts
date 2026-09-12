import type { ConfigFormJsonObject, ConfigFormValueContext } from '@moluoxixi/config-form-core'
import type { PageGraph } from '@moluoxixi/config-form-model'
import { createConfigFormValueScopeStore } from '@moluoxixi/config-form-core'
import { deriveProjectPageValueSchema } from '@moluoxixi/config-form-model'

export function createWorkbenchDataTestContext(
  graph: PageGraph | undefined,
  values: Record<string, unknown>,
): ConfigFormValueContext {
  if (!graph)
    return { fields: {} }
  const schema = deriveProjectPageValueSchema(graph)
  const store = createConfigFormValueScopeStore({
    fields: schema.scopedFields,
    scopes: schema.valueScopes,
    values: values as ConfigFormJsonObject,
  })
  return {
    resolveField: (nodeId) => {
      try {
        const value = store.getValue(nodeId)
        return value === undefined ? { found: false } : { found: true, value }
      }
      catch {
        return { found: false }
      }
    },
  }
}
