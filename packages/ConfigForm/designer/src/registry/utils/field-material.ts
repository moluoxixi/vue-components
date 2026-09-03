import type { ModelJsonObject, ModelJsonValue } from '@moluoxixi/config-form-model'
import type {
  DesignerFieldMaterialPropertyDefinition,
  DesignerPropertySetterDefinition,
} from '../types'

export function cloneDesignerJsonValue<T extends ModelJsonValue>(value: T): T {
  return structuredClone(value)
}

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
