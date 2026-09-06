import type { ModelJsonObject } from '@moluoxixi/config-form-model'
import type {
  DesignerFieldMaterialPropertyDefinition,
  DesignerPropertySetterDefinition,
} from '../types'
import { cloneConfigFormJsonValue } from '@moluoxixi/config-form-core'

export const cloneDesignerJsonValue = cloneConfigFormJsonValue

export function resolveDesignerDefaultField(key: string): string {
  const field = key.split('.').at(-1)?.replace(/\W+/g, '_').replace(/^_+|_+$/g, '')
  return field || 'field'
}

export function createDesignerFieldPropertySetter(
  key: string,
  definition: DesignerFieldMaterialPropertyDefinition,
): DesignerPropertySetterDefinition {
  const { default: _default, ...setter } = definition
  return {
    ...setter,
    key,
    path: ['props', key],
  }
}

export function createDesignerFieldPropertyDefaults(
  definitions: Readonly<Record<string, DesignerFieldMaterialPropertyDefinition>>,
): ModelJsonObject {
  return Object.fromEntries(Object.entries(definitions).flatMap(([key, definition]) => (
    definition.default === undefined
      ? []
      : [[key, cloneDesignerJsonValue(definition.default)]]
  )))
}
