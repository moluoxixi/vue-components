import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { ModelJsonObject } from '@moluoxixi/config-form-model'
import { createConfigFormValueScopeStore } from '@moluoxixi/config-form-core'

type CompiledSurface = ProjectCompilation['ir']['surfacesById'][string]

export function createSourceInitialValues(surface: CompiledSurface): ModelJsonObject {
  return createConfigFormValueScopeStore({
    scopes: surface.valueScopes.map(scope => ({ ...scope })),
    fields: surface.scopedFields.map(field => ({
      nodeId: field.nodeId,
      field: field.field,
      ...(field.scopeId === undefined ? {} : { scopeId: field.scopeId }),
      ...(field.defaultValue === undefined
        ? {}
        : { defaultValue: structuredClone(field.defaultValue) as ModelJsonObject[string] }),
    })),
  }).getValues() as ModelJsonObject
}
