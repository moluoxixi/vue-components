import type { ModelJsonObject, ModelJsonValue } from '@moluoxixi/config-form-model'
import type {
  DesignerFieldMaterialDefinition,
  DesignerFieldMaterialOptions,
  DesignerFieldMaterialPropertyDefinition,
  DesignerPropertySetterDefinition,
} from '../types'

function cloneJsonValue<T extends ModelJsonValue>(value: T): T {
  return structuredClone(value)
}

function defaultFieldFor(key: string): string {
  const field = key.split('.').at(-1)?.replace(/\W+/g, '_').replace(/^_+|_+$/g, '')
  return field || 'field'
}

function propertySetter(
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

function propertyDefaults(
  definitions: Readonly<Record<string, DesignerFieldMaterialPropertyDefinition>>,
): ModelJsonObject {
  return Object.fromEntries(Object.entries(definitions).flatMap(([key, definition]) => (
    definition.default === undefined
      ? []
      : [[key, cloneJsonValue(definition.default)]]
  )))
}

/** Defines the common one-field material shape without exposing node-factory boilerplate. */
export function defineDesignerFieldMaterial(
  options: DesignerFieldMaterialOptions,
): DesignerFieldMaterialDefinition {
  const {
    component,
    defaultField = defaultFieldFor(options.key),
    defaultLabel = options.title,
    defaultProps = {},
    props = {},
    runtime = {},
    setters = [],
    value,
    version = 1,
    ...definition
  } = options
  const initialProps = {
    ...structuredClone(defaultProps),
    ...propertyDefaults(props),
  }
  const initialDefaultValue = value?.default === undefined
    ? undefined
    : cloneJsonValue(value.default)
  const generatedSetters: DesignerPropertySetterDefinition[] = [
    ...(value
      ? [{
          key: 'defaultValue',
          label: value.label ?? 'Default value',
          path: ['defaultValue'],
          control: 'defaultValue' as const,
          valueKind: value.kind,
        }]
      : []),
    ...Object.entries(props).map(([key, prop]) => propertySetter(key, prop)),
    ...setters,
  ]

  return {
    ...definition,
    version,
    kind: 'field',
    runtime: { ...runtime, component },
    setters: generatedSetters,
    createNode: ({ id, field = defaultField }) => ({
      id,
      kind: 'field',
      component: definition.key,
      field,
      label: defaultLabel,
      props: structuredClone(initialProps),
      ...(initialDefaultValue === undefined
        ? {}
        : { defaultValue: cloneJsonValue(initialDefaultValue) }),
    }),
  }
}
